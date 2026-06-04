# VAN Order Control Tower

Order-to-shipment control system for Vital Agri Nutrients.
**Code and data are separate**: the app code lives here (GitHub → Render); the team's live data
(orders, users, production, QC, shipments) lives in a PostgreSQL database that **survives every deploy**.
So you can keep developing and redeploying without ever losing real data.

## Architecture (plain language)
- `server.js` — tiny Node server. Serves the app and stores/loads ALL data in the database.
- `index.html` — the app. It reads/writes data from the server (no longer from the browser),
  so every team member sees the SAME live data, and it refreshes automatically every few seconds.
- Login (who is signed in) stays per-browser; everything else is shared in the database.

## One-time deploy to Render (no coding)
1. Push this folder to a **private** GitHub repo (index.html, server.js, package.json, render.yaml, .gitignore, ).
2. In Render → **New + → Blueprint** → connect your GitHub repo → Render reads `render.yaml` and
   creates **both** the web service and the PostgreSQL database, and links them automatically.
3. Click **Apply**. Wait for the first deploy. Your live URL appears (e.g. https://van-control-tower.onrender.com).
4. Open it, sign in (admin / change the password immediately in Users & Access).

## Updating later (your dev loop)
- Edit the code → commit & push to GitHub → Render auto-deploys the new code.
- **The data is untouched** — it's in the database, not in the code.

## Notes
- Free Render web services sleep after inactivity (first visit may take ~30–60s to wake). Upgrade to a paid
  instance (~$7/mo) to keep it always-on. The free PostgreSQL is fine to start; a paid DB (~$7/mo) is recommended for production.
- Multiple people can use it at once; the screen auto-refreshes. Avoid two people editing the *exact same* record at the *exact same second* (last save wins).
- Keep the repository PRIVATE — it contains seeded login passwords until you change them in-app.

## Run locally (optional)
`npm install` then `npm start` → http://localhost:3000 (uses a local file for data when no DATABASE_URL is set).
