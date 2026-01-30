# Coup — 政变

Multiplayer web implementation of the card game **Coup**. Create a room, share the code, and play with friends in the browser (desktop + mobile).

- **Frontend:** Vite + React, TypeScript, Tailwind  
- **Backend:** Node + Express, Socket.io  
- **i18n:** English / 中文  

---

## Run locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the app:
   - **Frontend only:** `npm run dev` (client runs; you need the server for multiplayer)
   - **Server only:** `npm run dev:server`
   - **Both:** `npm run dev:all` (recommended)

3. Open the URL shown by Vite (e.g. `http://localhost:5173`). Create a room, share the room code, and join from another tab or device.

---

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Vite dev server (frontend) |
| `npm run dev:server` | Socket.io server (backend) |
| `npm run dev:all` | Frontend + server concurrently |
| `npm run build` | Build frontend to `dist/` |
| `npm run preview` | Preview production build |
| `npm run icons` | Generate PWA icons from `assets/logo.jpg` → `public/assets/` |

---

## Install as PWA (Progressive Web App)

The app is installable on **iOS**, **Android**, and **desktop Chrome** and runs in standalone display (no browser UI).

- **Chrome / Edge (desktop):** Use the **Install app** button in the game header, or the install icon in the address bar.
- **Android (Chrome):** Open the site, then **Menu → Install app** or accept the install banner.
- **iOS (Safari):** Tap **Share** → **Add to Home Screen** → Add. (The in-app tip “Use Share → Add to Home Screen” appears on iOS when not already installed.)

**First-time setup (icons):** After `npm install`, run `npm run icons` once to generate PWA icons (`public/assets/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`) from `assets/logo.jpg`. Commit the generated files if you deploy.

**Offline:** If you open the app without a connection, a branded offline page is shown. Gameplay still requires a connection to the server.

---

## Deploy

See **[DEPLOY.md](DEPLOY.md)** for deploying the frontend (e.g. Vercel) and the Socket.io server (e.g. Render).

---

## Project layout

- `src/` — React app (App, hooks, net, easterEggs)
- `components/` — UI (PlayerCard, GameLog, Button, BottomSheet)
- `server/` — Socket.io game server
- `services/` — Game engine (rules, state)
- `constants/` — Role metadata, i18n

Easter eggs: certain player names get subtle visual tweaks (emojis, colors, effects). Mapping lives in `src/easterEggs.ts`; visuals only, no gameplay changes.
