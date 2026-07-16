# VAN Order Control Tower

Order-to-shipment control system for Vital Agri Nutrients.
**Code and data are separate**: the app code lives here (GitHub → Render); the team's live data
(orders, users, production, QC, shipments) lives in an external **MySQL database (hosted on HostGator)**
that **survives every deploy**. So you can keep developing and redeploying without ever losing real data.

## Architecture (plain language)
- `server.js` — tiny Node server. Serves the app and stores/loads ALL data in the database.
- `index.html` — the app. It reads/writes data from the server (no longer from the browser),
  so every team member sees the SAME live data, and it refreshes automatically every few seconds.
- Login (who is signed in) stays per-browser; everything else is shared in the database.

## One-time deploy to Render (no coding)
1. Push this folder to a **private** GitHub repo (index.html, server.js, package.json, render.yaml, .gitignore, ).
2. In Render → **New + → Blueprint** → connect your GitHub repo → Render reads `render.yaml` and
   creates the web service. (The database is **not** created by Render — it's the external HostGator MySQL.)
3. In the service's **Environment** tab, set two variables by hand:
   - `DATABASE_URL` = `mysql://<user>:<url-encoded-password>@<hostgator-host>:3306/<dbname>`
   - `SESSION_SECRET` = any long random string (keeps logins stable across restarts)
   In HostGator cPanel → **Remote MySQL**, allow Render's outbound host to connect to the DB.
4. Click **Apply**. Wait for the first deploy. Your live URL appears (e.g. https://van-control-tower.onrender.com).
5. Open it, sign in (admin / change the password immediately in Users & Access).

## Updating later (your dev loop)
- Edit the code → commit & push to GitHub → Render auto-deploys the new code.
- **The data is untouched** — it's in the database, not in the code.

## Notes
- Free Render web services sleep after inactivity (first visit may take ~30–60s to wake). Upgrade to a paid
  instance (~$7/mo) to keep it always-on. The MySQL database is hosted separately on HostGator (independent of Render's plan).
- Multiple people can use it at once; the screen auto-refreshes. Avoid two people editing the *exact same* record at the *exact same second* (last save wins).
- Keep the repository PRIVATE — it contains seeded login passwords until you change them in-app.

## Run locally (optional)
`npm install` then `npm start` → http://localhost:3000 (uses a local file for data when no DATABASE_URL is set).
