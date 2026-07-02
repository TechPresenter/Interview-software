# Deploying HireSense to a Hostinger VPS (KVM plan) — step by step

A friendly, copy‑paste guide. You don't need to write code — just paste commands
and fill in a few values. Budget ~30–45 minutes.

**What we'll set up:** your code running on the VPS, kept alive by **PM2**, served
over your domain with **HTTPS** via **Nginx + Let's Encrypt**. Database uses
**MongoDB Atlas** (free/managed — nothing to install), and **Redis** runs on the VPS.

> Replace `YOUR_DOMAIN` with your real domain and `VPS_IP` with your server's IP
> everywhere you see them.

---

## Step 0 — Prerequisites (do these first)

1. **Code is on GitHub.** The full project must be pushed to
   `https://github.com/TechPresenter/Interview-software` (branch `main`). If you're
   unsure, ask and it can be pushed for you.
2. **Domain (recommended).** In your domain's DNS, add an **A record**:
   - `@`  →  `VPS_IP`
   - `www` → `VPS_IP`
   (In Hostinger: hPanel → Domains → DNS/Nameservers.) DNS can take 5–60 min.
   *No domain yet? You can still test via `http://VPS_IP` and add the domain later.*
3. **MongoDB Atlas.** Have your connection string ready
   (`mongodb+srv://user:pass@cluster.../hiresense`). In Atlas → Network Access,
   allow your `VPS_IP` (or `0.0.0.0/0`).
4. **Anthropic API key** (for the AI features) — optional; the app runs without it.

---

## Step 1 — Connect to the VPS

Easiest: Hostinger hPanel → **VPS → Manage → Browser terminal** (logs you in as
`root`). Or use SSH from your PC:

```bash
ssh root@VPS_IP
```

(Use the root password Hostinger emailed you.)

---

## Step 2 — Install everything (one script)

```bash
# grab the code
cd /root
git clone https://github.com/TechPresenter/Interview-software.git hiresense
cd hiresense

# install Node 20, Redis, Nginx, PM2, Certbot
bash deploy/setup.sh
```

---

## Step 3 — Add your secrets (2 small files)

### Backend — `server/.env`
```bash
nano server/.env
```
Paste this, editing the values in **CAPS**:
```env
NODE_ENV=production
PORT=5000
API_PREFIX=/api/v1
CLIENT_URL=https://YOUR_DOMAIN
API_PUBLIC_URL=https://YOUR_DOMAIN/api/v1

MONGO_URI=YOUR_ATLAS_CONNECTION_STRING
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=PASTE_A_LONG_RANDOM_STRING
JWT_REFRESH_SECRET=PASTE_ANOTHER_LONG_RANDOM_STRING

ANTHROPIC_API_KEY=YOUR_CLAUDE_KEY   # optional
AI_ENCRYPTION_KEY=PASTE_A_THIRD_RANDOM_STRING
```
Generate the random strings quickly:
```bash
openssl rand -hex 32   # run 3 times, paste each into a JWT_/AI_ field
```
Save in nano: `Ctrl+O`, `Enter`, then `Ctrl+X`.

### Frontend — `client/.env.local`
```bash
nano client/.env.local
```
```env
NEXT_PUBLIC_API_URL=https://YOUR_DOMAIN/api/v1
NEXT_PUBLIC_SOCKET_URL=https://YOUR_DOMAIN
NEXT_PUBLIC_SITE_URL=https://YOUR_DOMAIN
NEXT_PUBLIC_APP_NAME=HireSense
```
Save and exit.

> ⚠️ The frontend "bakes in" these URLs when it builds, so set them **before** the
> build in the next step. If you change the domain later, re-run the build.

---

## Step 4 — Install, build, seed, and start

```bash
# backend deps
cd /root/hiresense/server && npm ci

# frontend deps + production build
cd /root/hiresense/client && npm ci && npm run build

# create the first admin login + starter data
cd /root/hiresense/server && npm run seed

# start BOTH apps and keep them running forever
cd /root/hiresense && pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup   # copy–paste the command it prints, then run it (enables boot start)
```

Check they're up:
```bash
pm2 status
curl -s http://localhost:5000/health   # should say {"success":true,...}
```

---

## Step 5 — Put it on your domain (Nginx)

```bash
cp /root/hiresense/deploy/nginx.conf.example /etc/nginx/sites-available/hiresense
nano /etc/nginx/sites-available/hiresense   # replace YOUR_DOMAIN (2 places), save

ln -s /etc/nginx/sites-available/hiresense /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

Now `http://YOUR_DOMAIN` should load the app.

---

## Step 6 — Turn on HTTPS (free, automatic)

```bash
certbot --nginx -d YOUR_DOMAIN -d www.YOUR_DOMAIN
```
Follow the prompts (enter your email, agree). Certbot installs the certificate and
auto-renews it. Your site is now `https://YOUR_DOMAIN` 🎉

---

## Step 7 — Log in

Open `https://YOUR_DOMAIN/login`:
- **Super admin:** `admin@hiresense.ai` / `ChangeMe123!` → **change this password immediately**.

Then configure the rest from the **admin panel** (no code needed):
- **System → SMTP** (email) + **Test email**
- **AI Management** → add your AI provider key(s)
- **White Label** → logo, colors, name
- **Billing/System** → Stripe / Razorpay / Cashfree keys

---

## Everyday maintenance

```bash
pm2 status                 # are the apps running?
pm2 logs hiresense-api     # backend logs
pm2 logs hiresense-web     # frontend logs
pm2 restart all            # restart after changes
```

### Deploy an update (after new code is pushed to GitHub)
```bash
cd /root/hiresense && git pull
cd server && npm ci
cd ../client && npm ci && npm run build
cd .. && pm2 restart all
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Site won't load | `pm2 status` (both online?), `nginx -t && systemctl reload nginx` |
| 502 Bad Gateway | apps not running → `pm2 restart all`; check `pm2 logs` |
| Can't connect to DB | add `VPS_IP` to Atlas → Network Access; check `MONGO_URI` |
| Login/API fails from browser | `NEXT_PUBLIC_API_URL` must be `https://YOUR_DOMAIN/api/v1`, then rebuild client |
| Emails not sending | set SMTP under System settings + use **Test email** |
| Firewall blocks site | `ufw allow 80,443/tcp` (if UFW is on) |

---

## Alternative: Docker (advanced)

The repo also has `docker-compose.yml`. On a VPS with Docker you can
`docker compose up -d --build`, but you must first edit the web service's
`NEXT_PUBLIC_API_URL` to your domain and add a reverse proxy + SSL — so for a
non‑coder the PM2 + Nginx path above is simpler and fully documented.
