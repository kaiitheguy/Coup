# Deployment Guide: Coup Web (Vercel + Render)

This doc describes how to deploy the **Vite + React** frontend to **Vercel** and the **Socket.io** server to **Render**. The repo includes one-click–style config: **`vercel.json`** (Vercel) and **`render.yaml`** (Render).

---

## Config Files

- **`vercel.json`** – Vite SPA: build output `dist`, rewrites so all routes fallback to `/index.html` (e.g. `/room/ABC`, `/game/ABC` load the app and client-side routing handles them).
- **`render.yaml`** – Blueprint for one Render Web Service: `coup-server`, root `server`, Node runtime, build/start commands, env vars, health check at `/health`.
- **Server health:** `GET /health` returns `200` with body `ok` (used by Render health checks).

---

## Prerequisites

- Git repo with this codebase
- [Vercel](https://vercel.com) and [Render](https://render.com) accounts
- Deploy **backend first** so you have the server URL for the frontend env var

---

## A) Deploy Server to Render

**Option 1: Blueprint (recommended)**

1. Render Dashboard → **New** → **Blueprint**.
2. Connect the repo; Render will detect **`render.yaml`**.
3. Confirm the service:
   - **Name:** `coup-server`
   - **Root Directory:** `server`
   - **Build:** `npm install && npm run build`
   - **Start:** `npm start`
   - **Health Check Path:** `/health`
   - **Env:** `NODE_ENV=production`, `CORS_ORIGIN=*` (set in blueprint; tighten `CORS_ORIGIN` later if needed).
4. Deploy. Render sets `PORT`; the server uses `process.env.PORT`.
5. Copy the service URL (e.g. `https://coup-server.onrender.com`).

**Option 2: New Web Service (manual)**

1. **New** → **Web Service**.
2. Connect repo.
3. Set **Root Directory** to `server`.
4. **Build Command:** `npm install && npm run build`
5. **Start Command:** `npm start`
6. **Health Check Path:** `/health`
7. **Environment:** `NODE_ENV` = `production`, `CORS_ORIGIN` = `*` (or your Vercel URL).
8. Deploy and copy the service URL.

---

## B) Deploy Frontend to Vercel

1. **New Project** → import your Git repo.
2. Vercel will use **`vercel.json`** (framework: Vite, output: `dist`, SPA rewrites).
3. **Environment variables:**
   - **Name:** `VITE_SERVER_URL`
   - **Value:** `https://<your-render-service-url>` (e.g. `https://coup-server.onrender.com`)
   - **Environment:** Production (and Preview if desired).
4. Deploy. Visiting `/`, `/room/ABC`, or `/game/ABC` serves the app; client-side routing applies.

---

## C) CORS

- Server reads `CORS_ORIGIN` (single origin or comma-separated list; spaces trimmed).
- **Local:** `CORS_ORIGIN=http://localhost:3000`
- **Production:** set `CORS_ORIGIN` to your Vercel URL, e.g. `https://your-app.vercel.app`.
- **Multiple origins:** `CORS_ORIGIN=https://app.vercel.app,https://www.yourapp.com`
- `render.yaml` defaults to `*`; in Render dashboard you can override with your Vercel URL for tighter security.
- Do not commit `.env`; only `.env.example` files are in the repo.

---

## D) Local Development

- **Frontend:** `npm run dev` (Vite, default `http://localhost:3000`)
- **Server:** `npm run dev:server` (tsx, default port 3001)
- **Both:** `npm run dev:all`
- **Env:** Copy `.env.example` to `.env` and set `VITE_SERVER_URL=http://localhost:3001`. In `server/`, copy `server/.env.example` to `server/.env` and set `PORT=3001`, `CORS_ORIGIN=http://localhost:3000`.

**Production-style server locally:**

- `npm run build:server` then `npm run start:server`
- `GET http://localhost:3001/health` should return `200 ok`.

---

## E) Troubleshooting

**CORS origin mismatch**

- Symptom: Browser blocks requests to the server with CORS errors.
- Fix: Set Render env `CORS_ORIGIN` to your exact frontend origin (e.g. `https://your-app.vercel.app`). No trailing slash. For multiple domains, use comma-separated list.

**Wrong or missing VITE_SERVER_URL**

- Symptom: Frontend can’t connect to the server; socket never connects or connects to wrong host.
- Fix: In Vercel, set **Environment Variable** `VITE_SERVER_URL` to the full Render URL (e.g. `https://coup-server.onrender.com`). Redeploy after changing (Vite bakes this in at build time).

**Render free tier cold start**

- Symptom: First request after idle takes 30–60+ seconds; health check may fail and Render may mark the service unhealthy.
- Fix: Normal on free tier. Either accept the delay, use a paid plan for always-on, or add an external uptime ping to hit `/health` periodically to reduce cold starts.

**SPA routes 404 on refresh**

- Symptom: Refreshing on `/room/ABC` returns 404.
- Fix: Ensure **`vercel.json`** is in the repo with the rewrite: `"source": "/(.*)", "destination": "/index.html"`. Redeploy.

**Health check failing**

- Ensure server exposes `GET /health` (returns 200 and body `ok`). In Render, **Health Check Path** should be `/health` (no leading domain).

---

## F) Checklist

- [ ] Server deployed on Render; `PORT` and `CORS_ORIGIN` set; `/health` returns ok.
- [ ] Frontend deployed on Vercel; `VITE_SERVER_URL` set to Render URL.
- [ ] SPA routes (e.g. `/room/ABC`) work on refresh (Vercel rewrites).
- [ ] No `.env` or secrets committed; only `.env.example` files in repo.
- [ ] Local dev and production builds work (`npm run build`, `npm run build:server`).
