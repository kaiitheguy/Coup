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
