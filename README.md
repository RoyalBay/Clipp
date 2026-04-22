<p align="center">
  <img src="assets/favicon.svg" width="64" alt="Clipp logo">
</p>

<h1 align="center">Clipp</h1>
<p align="center"><strong>Audio-first social.</strong> No screen required.</p>

---

## ✨ Features

- **TikTok-style feed** — Full-screen vertical snap-scroll through audio clips
- **One-tap recording** — Record, title, and post in seconds
- **Password auth** — SHA-256 hashed credentials
- **Moderation** — Official @clipp account can delete clips/comments and ban users
- **Siri / AirPods** — Hands-free recording via iOS Shortcuts
- **Waveform visualization** — Every clip gets a unique audio fingerprint
- **Likes & comments** — Engage with the community
- **Dark industrial aesthetic** — Jet black + electric amber

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML, CSS, JS |
| Backend | [Supabase](https://supabase.com) |
| Auth | Username + password (SHA-256) |
| Audio | Web Audio API + MediaRecorder |

## 🚀 Getting Started

1. Clone and configure Supabase (see `.env.example`)
2. Update `js/config.js` with your credentials
3. Run `npm run dev`

## 📁 Structure

```
css/     — 6 stylesheets (variables, base, components, feed, record, animations)
js/      — 9 modules (config, state, utils, auth, audio, feed, record, comments, app)
assets/  — favicon
```

## 📄 License

MIT
