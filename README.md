# NMSU College Assistant Professor Application Dashboard

A GitHub Pages-ready dashboard for managing the NMSU Communication Studies College Assistant Professor application.

## What already works

- responsive application dashboard
- job requirements and teaching expectations
- persistent checkboxes and progress
- notes and drafting areas
- editable "Your Fit" evidence
- document upload/download/delete
- backup export/import
- deadline countdown
- saved link back to the ChatGPT conversation
- local/offline browser storage fallback

## Recommended architecture

- **GitHub** = master copy of the website code
- **GitHub Pages** = live public URL
- **GitHub Actions** = automatic deployment
- **Supabase** = authenticated cross-device tasks, notes, settings, and private files

Without Supabase, the site still works, but checkboxes/notes/files belong to the browser/device where you entered them.

## 1. Create a GitHub repository

Create a repository such as:

`nmsu-job-application-dashboard`

Upload the contents of this folder to the repository root. The homepage is already named `index.html`.

## 2. Publish with GitHub Pages

This repository includes `.github/workflows/deploy.yml`.

In GitHub:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions**.
3. Commit/push to `main`.
4. The workflow will publish the site.

Your final URL will look like:

`https://YOUR-USERNAME.github.io/nmsu-job-application-dashboard/`

## 3. Optional but recommended: enable cross-device cloud sync

Create a Supabase project at https://supabase.com/.

### Database/storage setup

1. Open **SQL Editor** in Supabase.
2. Paste and run the complete contents of `supabase_setup.sql`.
3. In **Authentication → URL Configuration**, add your final GitHub Pages URL as an allowed redirect URL.

### Add the public browser configuration

Open `js/config.js` and fill in:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_PUBLISHABLE_OR_ANON_KEY",
  STORAGE_BUCKET: "application-files"
};
```

The browser anon/publishable key is safe to expose only when Row Level Security is enabled. The provided SQL enables RLS. **Never put a Supabase service-role key, password, or other private secret in GitHub Pages.**

Commit that change. GitHub Actions republishes the site automatically.

## 4. Sign in

Once configured, open the dashboard and go to **Settings / Sync**.

Enter your email and select **Email me a sign-in link**. After signing in:

- checkboxes sync across devices
- notes sync across devices
- your saved ChatGPT conversation link syncs
- fit-note edits sync
- uploaded documents are stored privately in Supabase Storage

## 5. Link the dashboard back to this ChatGPT conversation

Open this ChatGPT conversation in your browser and copy its URL. In the dashboard:

**Settings / Sync → Return to this ChatGPT chat → paste URL → Save link**

The button at the top of the dashboard will then return you to this conversation.

## 6. Normal use after setup

You should rarely need to edit GitHub directly.

- design/features → update GitHub code
- checkboxes/progress → update inside dashboard
- notes → update inside dashboard
- fit evidence → update inside dashboard
- application documents → upload inside dashboard
- use another device → open the same GitHub Pages URL and sign in

## Files

- `index.html` — application shell
- `css/app.css` — presentation
- `js/app.js` — dashboard logic, local fallback, Supabase sync
- `js/config.js` — public Supabase browser configuration
- `data/defaults.json` — job requirements, checklist, fit starter data
- `supabase_setup.sql` — database/storage/RLS setup
- `.github/workflows/deploy.yml` — automatic GitHub Pages deployment

