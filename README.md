# Clipp — audio social

A static, audio-first social web app. Hosted on GitHub Pages. Posts, likes, and comments are stored as plain files directly in this repo.

---

## How to deploy (one time)

### 1. Create a GitHub account (if you don't have one)
Go to https://github.com and sign up.

### 2. Create a new public repo
- Go to https://github.com/new
- Name it something like `Clipp-app`
- Set it to **Public** (required for GitHub Pages + reading posts without auth)
- Click **Create repository**

### 3. Upload these files
- Click **Add file → Upload files**
- Drag in: `index.html`, `style.css`, `app.js`, `github.js`, `recorder.js`, `feed.js`, `myposts.js`
- Commit with message: `initial deploy`

### 4. Enable GitHub Pages
- Go to your repo → **Settings** → **Pages**
- Under "Source", select **Deploy from a branch**
- Branch: `main`, folder: `/ (root)`
- Click **Save**
- Wait ~60 seconds, then your app is live at:
  `https://YOUR-USERNAME.github.io/Clipp-app/`

### 5. Create a content folder
GitHub requires at least one file in a folder to create it. Either:
- Create a file called `content/.gitkeep` (click Add file → Create new file, type `content/.gitkeep` as the name)

### 6. Create a Personal Access Token
- Go to https://github.com/settings/tokens/new
- Name: `Clipp app`
- Scopes: check **repo** (full repo access)
- Click **Generate token**
- **Copy the token immediately** — you won't see it again
- Paste it into Clipp's Settings → GitHub Backend

---

## File structure

```
Clipp-app/
├── index.html
├── style.css
├── app.js
├── github.js
├── recorder.js
├── feed.js
├── myposts.js
├── README.md
└── content/
    ├── u_a3f9k2.1.webm          ← audio
    ├── u_a3f9k2.1.txt           ← metadata
    ├── u_a3f9k2.1.likes.txt     ← one line per like
    ├── u_a3f9k2.1.comments.txt  ← one line per comment
    └── ...
```

### Metadata format (`.txt`)
```
title: Morning thought
hashtags: #mindset #morning
duration: 00:42
posted: 2026-04-20T08:32:00Z
userid: u_a3f9k2
username: alice
postindex: 1
```

### Likes format (`.likes.txt`)
```
bob.2026-04-20T09:00:00Z
carol.2026-04-20T10:15:00Z
```

### Comments format (`.comments.txt`)
```
bob.2026-04-20T09:01:00Z.loved this Clipp
carol.2026-04-20T10:16:00Z.so true
```

---

## Keyboard controls (for PC testing)

| Key | Action |
|-----|--------|
| Space | start recording / stop recording |
| P | confirm and post |
| D | discard Clipp |
| Hold Space | pause/resume review playback |

---

## "Hey Siri, Clipp it" setup

Once deployed, create a Shortcut on iPhone:
1. Open **Shortcuts** app
2. New shortcut → Add Action → **Open URLs**
3. URL: `https://YOUR-USERNAME.github.io/Clipp-app/#record`
4. Rename to **"Clipp it"** → Done
5. Say "Hey Siri, Clipp it" to jump straight to recording
