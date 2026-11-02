# Skill Tree

A personal leveling app: skill trees, ranked skills that unlock in order, quests, XP, levels, and a daily focus streak. It installs to your phone's home screen and works offline.

## Files
- `index.html`: the page shell
- `styles.css`: the look
- `app.js`: all the logic, plus the starter Product Owner tree (`seedPO`)
- `manifest.webmanifest` + ``: what makes it installable
- `sw.js`: offline support (bump `CACHE` when you change files)

## Put it online free with GitHub Pages
1. Create a free account at github.com.
2. Click **New repository**, name it `skill-tree`, set it to **Public**, and create it.
3. Click **uploading an existing file**, select every file, then click **Commit changes**.
4. Go to **Settings → Pages**. Under "Branch," pick `main` and `/ (root)`, then click **Save**.
5. After a minute or two, your app is live at `https://YOUR-USERNAME.github.io/skill-tree/`.

## Install it on your iPhone
Open that link in **Safari**, tap **Share**, then tap **Add to Home Screen**.

## Your data and syncing
Progress always saves on the device first. When you sign in (Settings → Sync across devices), it also syncs to your Supabase project, so your phone and iPad share the same trees, XP, and streak. Sync details live in `config.js`, and the database table setup is in `supabase-setup.sql`.

Note: free Supabase projects pause after about a week with no activity. If that happens, sync will show a problem. Open your project on supabase.com and tap **Restore**. Your data is kept.

## Ideas for later
- Daily reminders
- Quest notes and journal
- Achievements and titles
