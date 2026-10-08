# Deployment checklist — ViH Metaverse CRM

Work through these in order. Steps 1–5 must be done before real users sign in.

## 1. Commit and push the code

Nothing from the latest round of changes is committed yet. Most hosts deploy from GitHub.

```bash
git add -A
git status          # check .env and .env.local are NOT listed (they are gitignored)
git commit -m "CRM redesign: dashboards, deal board, team messaging, date picker"
git push
```

## 2. Make sure the production database is reachable

The Neon database in `.env` could not be reached during development. Open the Neon dashboard, wake or restore the
project, and copy the current connection string into the host's `DATABASE_URL` setting.

## 3. Apply the database migrations

Run once against the **production** database (adds the messaging tables and the CFO/CTO/CSO/Regional Sales Head roles):

```bash
DATABASE_URL="<production connection string>" npx prisma migrate deploy
```

Never run `npm run db:seed`, `db:seed:history`, or `db:seed:messages` against production — the main seed **deletes all CRM data**.

## 4. Set production environment variables on the host

| Variable | Value |
|---|---|
| `DATABASE_URL` | Production Neon connection string |
| `SESSION_SECRET` | A new random value — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `APP_URL` | The public URL, e.g. `https://crm.example.com` |
| `NODE_ENV` | `production` |

Do not reuse the `SESSION_SECRET` from `.env`; it is a readable phrase, not a random key.

## 5. Create the first administrator

A fresh production database has no users, and the demo accounts are never created in production. Create one admin
(password is read from the environment, minimum 10 characters):

```bash
ADMIN_PASSWORD='<strong password>' DATABASE_URL="<production connection string>" \
  npm run create-admin -- --email you@company.com --name "Your Name"
```

Then sign in and add the rest of the team under **User Management**.

## 5b. Remove or secure the demo accounts

If the production database was ever seeded, these accounts exist with the published password `ViH@Demo2026!`:

`admin@vihmetaverse.com`, `vih.ceo@vih.demo`, `vih.sales@vih.demo`, `vih.finance@vih.demo`, `vih.tech@vih.demo`

Deactivate them in **User Management**, or change their passwords, and create real accounts for each person.

## 6. Build and start

```bash
docker build -t vih-crm .
docker run -p 3000:3000 --env-file <production env file> vih-crm
```

(or the equivalent on your host — the app builds as a Next.js standalone server on port 3000)

## 7. Smoke test after deploy

- Open `https://<your-app>/api/health`. It should return `"status":"ok"`. If not, `checks.database` says why:
  `not-configured` (no `DATABASE_URL`), `unreachable` (wrong/dead database), `tables-missing` (run step 3),
  and `hasUsers: false` means step 5 hasn't been done.

- Sign in as a real CEO, Sales, and Finance user; each lands on their own dashboard.
- Create a lead, a task (date picker), an opportunity, and a price request.
- Send a message in **Messages** and check it appears for another user.
- Download the Executive Summary PDF.

## Known follow-ups (not blocking)

- Add a limit on repeated sign-in attempts (brute-force protection).
- `npm run lint` needs an ESLint 9 config update.
- Messages refresh every few seconds rather than instantly.
- The CEO can approve a price request they raised themselves (by choice).

## Backups

Local snapshots of the code and the demo database are in `local-backups/` (not committed to git).
