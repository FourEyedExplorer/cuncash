# CUNCash — connected family spend tracker

One shared ledger that **Dad, Mom, Carter, and Jett all see live**. When anyone logs a
spend it appears on every phone within a second or two, and (optionally) buzzes the
others with a push notification. Hosts on **Netlify**, data lives in **Supabase**.

There's also a hidden **admin** screen: on Dad's flow tap the 🔑 and enter **9324** to
edit or delete any transaction.

---

## What you'll set up (about 20–30 min, one time)

```
Your phones ──▶ Netlify (serves the app) ──▶ Supabase (the shared ledger + realtime)
                      │
                      └──▶ Netlify Function (send-push) ──▶ everyone's phones (alerts)
```

You need two free accounts: **Supabase** (the shared database) and **Netlify** (hosting,
which you already have).

---

## Step 1 — Create the Supabase database

1. Go to supabase.com → **New project**. Pick any name/password, choose a region near you.
2. Open the project → **SQL Editor** → paste in the contents of `supabase/schema.sql` → **Run**.
   This creates the `transactions` and `push_subscriptions` tables and turns on realtime.
3. Go to **Project Settings → API** and copy these three values:
   - **Project URL**  → this is `SUPABASE_URL`
   - **anon public** key → this is `SUPABASE_ANON_KEY`
   - **service_role** key → this is `SUPABASE_SERVICE_ROLE_KEY` ⚠️ *secret — never put in the app code*

## Step 2 — Generate push (VAPID) keys

These sign your notifications. In a terminal:

```bash
npx web-push generate-vapid-keys
```

Copy the **Public Key** and **Private Key** it prints.

## Step 3 — Deploy to Netlify

Push this folder to a GitHub repo and "Add new site → Import from Git" in Netlify
(or drag the folder into Netlify and let it build). Build settings are already in
`netlify.toml` (build: `npm run build`, publish: `dist`).

## Step 4 — Add the environment variables in Netlify

Site → **Settings → Environment variables**. Add these (see `.env.example`):

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | your Project URL |
| `VITE_SUPABASE_ANON_KEY` | the anon public key |
| `VITE_VAPID_PUBLIC_KEY` | the VAPID **public** key |
| `SUPABASE_URL` | same Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role key (secret) |
| `VAPID_PUBLIC_KEY` | the VAPID public key |
| `VAPID_PRIVATE_KEY` | the VAPID **private** key (secret) |
| `VAPID_SUBJECT` | `mailto:you@youremail.com` |

The `VITE_` ones run in the browser; the rest are used only by the alert function on the
server. After adding them, **trigger a redeploy** so they take effect.

## Step 5 — Point your subdomain at it

In Netlify → **Domain settings**, add a subdomain like `cancun.yourdomain.com`. Done.

## Step 6 — Each person sets up their phone

1. Open the URL in the phone's browser.
2. **Add to Home Screen** (this matters — especially on iPhone, see below).
3. Open it from the home-screen icon, then tap **🔔 Turn on alerts on this phone** and allow notifications.

That's it — everyone now shares one live ledger.

---

## Good to know

- **Redeploys don't wipe data.** The ledger lives in Supabase, not in the code, so updating
  the app never resets transactions.
- **iPhone + push:** Apple only delivers web-push when the app has been **added to the Home
  Screen** (iOS 16.4 or newer) and opened from that icon — a plain Safari tab won't buzz when
  closed. Android is more forgiving. Either way, while the app is open everyone sees the live
  in-app banner regardless of device.
- **Security is "private link" level.** The database rules currently allow anyone who has your
  URL and anon key to read/write — fine for a private family trip, but don't post the link
  publicly. To lock it down later, add Supabase Auth and tighten the row-level-security policies.
- **Offline:** if a phone briefly loses signal, the entry still shows locally and syncs when the
  realtime connection returns. (There's no long-term offline queue — keep that in mind on the boat.)

## Run locally (optional)

```bash
npm install
cp .env.example .env   # fill in the VITE_ values
npm run dev
```

## Files

- `src/App.jsx` — the whole app (UI, keypad, totals, room folios, admin)
- `src/db.js` — Supabase reads/writes + realtime subscription
- `src/push.js` — turns on notifications for a device
- `netlify/functions/send-push.js` — sends the alerts
- `supabase/schema.sql` — run once to create the tables
