const LS_KEY='nmsu_job_dashboard_v2';
let defaults=null, supabaseClient=null, currentUser=null, saveTimer=null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const localState=()=>{try{return JSON.parse(localStorage.getItem(LS_KEY)||'{}')}catch{return{}}};
const writeLocal=s=>localStorage.setItem(LS_KEY,JSON.stringify(s));
const mergedState=()=>({tasks:{},notes:{},fit:{},chatUrl:'',...localState()});

async function init(){
  defaults=await fetch('data/defaults.json').then(r=>r.json());
  renderStatic();
  bindCore();
  await initCloud();
  await hydrate();
  updateCountdown();setInterval(updateCountdown,60000);
}

function renderStatic(){
  $('#positionGrid').innerHTML=defaults.position.map(([k,v])=>`<div class="info-box"><small>${esc(k)}</small><strong>${esc(v)}</strong></div>`).join('');
  $('#teachingChips').innerHTML=defaults.teaching.map(x=>`<span class="chip">${esc(x)}</span>`).join('');
  $('#requiredList').innerHTML=defaults.required.map(taskRow).join('');
  $('#workflowList').innerHTML=defaults.workflow.map(taskRow).join('');
  $('#notesGrid').innerHTML=defaults.notes.map(([id,label])=>`<div class="note-card"><label for="note-${id}">${esc(label)}</label><textarea id="note-${id}" data-note="${id}"></textarea></div>`).join('');
  renderFit(mergedState().fit);
}
function taskRow(t){return `<label class="check-row"><input type="checkbox" data-task="${t.id}"><div><div class="check-title">${esc(t.title)}</div><div class="check-desc">${esc(t.desc)}</div></div><span class="tag ${t.tag==='MEDIUM'?'med':t.tag==='AFTER'?'low':''}">${esc(t.tag)}</span></label>`}
function renderFit(overrides={}){$('#fitBody').innerHTML=defaults.fit.map(f=>{const evidence=overrides[f.id]??f.evidence;return `<tr><td>${esc(f.criterion)}</td><td>${esc(evidence)}</td><td class="status ${f.status}">${esc(f.label)}</td></tr>`}).join('')}

function bindCore(){
  document.addEventListener('change',e=>{if(e.target.matches('[data-task]')){saveTask(e.target.dataset.task,e.target.checked);refreshTaskVisuals()}});
  document.addEventListener('input',e=>{if(e.target.matches('[data-note]'))queueSaveNote(e.target.dataset.note,e.target.value)});
  $('#fileInput').addEventListener('change',e=>{uploadFiles([...e.target.files]);e.target.value=''});
  const dz=$('#dropZone');['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag')}));['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag')}));dz.addEventListener('drop',e=>uploadFiles([...e.dataTransfer.files]));
  $('#saveChatBtn').addEventListener('click',saveChatUrl);$('#openChatBtn').addEventListener('click',openChat);
  $('#editFitBtn').addEventListener('click',openFitEditor);$('#saveFitBtn').addEventListener('click',saveFitEditor);
  $('#exportBtn').addEventListener('click',exportBackup);$('#importInput').addEventListener('change',importBackup);
}

async function initCloud(){
  const cfg=window.APP_CONFIG||{};
  if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY){setBanner('Cloud sync is not configured yet. The dashboard works now with browser storage. Follow README.md to enable cross-device sync.','warning');renderAuthControls();return}
  try{
    supabaseClient=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
    const {data:{session}}=await supabaseClient.auth.getSession();currentUser=session?.user||null;
    supabaseClient.auth.onAuthStateChange(async(_event,session)=>{currentUser=session?.user||null;renderAuthControls();if(currentUser)await hydrate();else await hydrateLocalOnly()});
    setBanner(currentUser?'Cloud sync is connected and you are signed in.':'Cloud sync is configured. Sign in to synchronize this dashboard across devices.',currentUser?'success':'info');renderAuthControls();
  }catch(e){console.error(e);setBanner('Cloud configuration could not be initialized. Local browser storage remains active.','warning');renderAuthControls()}
}
function renderAuthControls(){
  const box=$('#authControls'), state=$('#authState');
  if(!supabaseClient){state.textContent='Local-only mode';box.innerHTML='<p class="muted small">Add your Supabase URL and anon key to js/config.js, run supabase_setup.sql once in Supabase, then redeploy.</p>';return}
  if(currentUser){state.textContent=`Signed in as ${currentUser.email}`;box.innerHTML='<button id="signOutBtn" class="btn outline">Sign out</button>';$('#signOutBtn').onclick=()=>supabaseClient.auth.signOut();return}
  state.textContent='Not signed in';box.innerHTML='<label>Email<input id="authEmail" type="email" placeholder="you@example.com"></label><button id="magicBtn" class="btn dark top-gap">Email me a sign-in link</button><p class="muted small">Supabase will send a passwordless magic link.</p>';$('#magicBtn').onclick=async()=>{const email=$('#authEmail').value.trim();if(!email)return alert('Enter your email first.');const {error}=await supabaseClient.auth.signInWithOtp({email,options:{emailRedirectTo:location.href.split('#')[0]}});alert(error?error.message:'Check your email for the sign-in link.')}
}

async function hydrate(){if(currentUser&&supabaseClient){await loadCloudState();await renderCloudFiles()}else{await hydrateLocalOnly();await renderLocalFiles()}refreshTaskVisuals()}
async function hydrateLocalOnly(){const s=mergedState();$$('[data-task]').forEach(x=>x.checked=!!s.tasks[x.dataset.task]);$$('[data-note]').forEach(x=>x.value=s.notes[x.dataset.note]||'');$('#chatUrl').value=s.chatUrl||'';renderFit(s.fit||{});refreshTaskVisuals()}
async function loadCloudState(){
  const {data,error}=await supabaseClient.from('dashboard_state').select('payload').eq('user_id',currentUser.id).maybeSingle();if(error){console.warn(error);return hydrateLocalOnly()}
  const cloud=data?.payload||{};const local=mergedState();const s={...local,...cloud,tasks:{...local.tasks,...(cloud.tasks||{})},notes:{...local.notes,...(cloud.notes||{})},fit:{...local.fit,...(cloud.fit||{})}};writeLocal(s);$$('[data-task]').forEach(x=>x.checked=!!s.tasks[x.dataset.task]);$$('[data-note]').forEach(x=>x.value=s.notes[x.dataset.note]||'');$('#chatUrl').value=s.chatUrl||'';renderFit(s.fit||{})
}
async function persistState(next){writeLocal(next);if(currentUser&&supabaseClient){const {error}=await supabaseClient.from('dashboard_state').upsert({user_id:currentUser.id,payload:next,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)console.warn(error)}}
async function saveTask(id,value){const s=mergedState();s.tasks[id]=value;await persistState(s)}
function queueSaveNote(id,value){clearTimeout(saveTimer);const s=mergedState();s.notes[id]=value;writeLocal(s);saveTimer=setTimeout(()=>persistState(mergedState()),450)}
function refreshTaskVisuals(){const boxes=$$('[data-task]');let done=0;boxes.forEach(cb=>{cb.closest('.check-row')?.classList.toggle('done',cb.checked);if(cb.checked)done++});const pct=boxes.length?Math.round(done/boxes.length*100):0;$('#progressBar').style.width=`${pct}%`;$('#progressText').textContent=`${pct}%`;$('#progressDetail').textContent=`${done} of ${boxes.length} tasks complete`}

function openFitEditor(){const s=mergedState();$('#fitEditor').innerHTML=defaults.fit.map(f=>`<div class="fit-edit-row"><label>${esc(f.criterion)}<textarea data-fit-edit="${f.id}">${esc(s.fit?.[f.id]??f.evidence)}</textarea></label></div>`).join('');$('#fitDialog').showModal()}
async function saveFitEditor(e){e.preventDefault();const s=mergedState();s.fit=s.fit||{};$$('[data-fit-edit]').forEach(el=>s.fit[el.dataset.fitEdit]=el.value);await persistState(s);renderFit(s.fit);$('#fitDialog').close()}
async function saveChatUrl(){const v=$('#chatUrl').value.trim();if(v&&!/^https:\/\/chatgpt\.com\//i.test(v))return alert('Paste a URL beginning with https://chatgpt.com/');const s=mergedState();s.chatUrl=v;await persistState(s);alert('Chat link saved.')}
function openChat(){const url=mergedState().chatUrl;if(url)window.open(url,'_blank','noopener');else{location.hash='#settings';$('#chatUrl').focus();alert('Paste this ChatGPT conversation URL in Settings once, then save it.')}}

// ----- Local file storage fallback (IndexedDB) -----
function dbOpen(){return new Promise((res,rej)=>{const r=indexedDB.open('nmsuJobDashboardFiles',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('files'))r.result.createObjectStore('files',{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function localFilePut(file){const db=await dbOpen();const tx=db.transaction('files','readwrite');tx.objectStore('files').put({id:crypto.randomUUID(),name:file.name,type:file.type,size:file.size,created_at:new Date().toISOString(),blob:file});return new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
async function localFiles(){const db=await dbOpen();const tx=db.transaction('files','readonly');return new Promise((res,rej)=>{const r=tx.objectStore('files').getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function localFileDelete(id){const db=await dbOpen();const tx=db.transaction('files','readwrite');tx.objectStore('files').delete(id);return new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}

async function uploadFiles(files){if(!files.length)return;if(currentUser&&supabaseClient){for(const file of files)await uploadCloudFile(file);await renderCloudFiles()}else{for(const file of files)await localFilePut(file);await renderLocalFiles()}}
async function uploadCloudFile(file){const cfg=window.APP_CONFIG;const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'_');const path=`${currentUser.id}/${Date.now()}-${safe}`;const up=await supabaseClient.storage.from(cfg.STORAGE_BUCKET).upload(path,file,{upsert:false});if(up.error)return alert(`Upload failed: ${up.error.message}`);const {error}=await supabaseClient.from('dashboard_files').insert({user_id:currentUser.id,name:file.name,path,size:file.size,mime_type:file.type});if(error)alert(error.message)}
async function renderCloudFiles(){const {data,error}=await supabaseClient.from('dashboard_files').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false});if(error){console.warn(error);return}renderFiles(data||[],true)}
async function renderLocalFiles(){const data=await localFiles();data.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));renderFiles(data,false)}
function renderFiles(list,cloud){const box=$('#fileList');if(!list.length){box.innerHTML='<p class="muted small">No files uploaded yet.</p>';return}box.innerHTML=list.map(f=>`<div class="file-row"><div><strong>${esc(f.name)}</strong><div class="file-meta">${fmtSize(f.size)} · ${cloud?'Cloud':'This browser'}</div></div><button class="btn outline" data-download="${f.id}" data-cloud="${cloud}">Open</button><button class="btn outline" data-delete="${f.id}" data-cloud="${cloud}">Delete</button></div>`).join('');$$('[data-download]').forEach(b=>b.onclick=()=>downloadStoredFile(b.dataset.download,b.dataset.cloud==='true'));$$('[data-delete]').forEach(b=>b.onclick=()=>deleteStoredFile(b.dataset.delete,b.dataset.cloud==='true'))}
async function downloadStoredFile(id,cloud){if(cloud){const {data}=await supabaseClient.from('dashboard_files').select('path').eq('id',id).single();if(!data)return;const {data:signed,error}=await supabaseClient.storage.from(window.APP_CONFIG.STORAGE_BUCKET).createSignedUrl(data.path,60);if(error)return alert(error.message);window.open(signed.signedUrl,'_blank','noopener')}else{const f=(await localFiles()).find(x=>x.id===id);if(!f)return;const u=URL.createObjectURL(f.blob);window.open(u,'_blank');setTimeout(()=>URL.revokeObjectURL(u),60000)}}
async function deleteStoredFile(id,cloud){if(!confirm('Delete this file?'))return;if(cloud){const {data}=await supabaseClient.from('dashboard_files').select('path').eq('id',id).single();if(data)await supabaseClient.storage.from(window.APP_CONFIG.STORAGE_BUCKET).remove([data.path]);await supabaseClient.from('dashboard_files').delete().eq('id',id);await renderCloudFiles()}else{await localFileDelete(id);await renderLocalFiles()}}

function updateCountdown(){const due=new Date('2027-01-04T07:00:00Z'),ms=due-new Date();const txt=ms<=0?'Deadline passed':`${Math.floor(ms/86400000)}d ${Math.floor(ms%86400000/3600000)}h ${Math.floor(ms%3600000/60000)}m`;$('#countdown').textContent=txt;$('#deadlineClock').textContent=txt}
function setBanner(text,type){const b=$('#cloudBanner');b.textContent=text;b.className=`banner ${type}`}
function exportBackup(){const blob=new Blob([JSON.stringify(mergedState(),null,2)],{type:'application/json'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`nmsu-application-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(u)}
async function importBackup(e){const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());await persistState({...mergedState(),...data});await hydrate();alert('Backup imported.')}catch{alert('That file is not a valid dashboard backup.')}e.target.value=''}
function fmtSize(n=0){return n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`}
function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

init().catch(e=>{console.error(e);setBanner('The page loaded with an error. Open the browser console for details.','warning')});
