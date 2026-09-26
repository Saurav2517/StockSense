# StockSense — Setup, Deployment & Demo Guide

This guide takes a fresh clone to a running app (locally and on Vercel) backed by a Supabase project.
The functional specification lives in `README.md`, `SystemDesign.md`, `SystemArchitecture.md`, `DataBase.md` and `features.md`.

---

## 1. Prerequisites

| Tool | Version |
| --- | --- |
| Node.js | 20+ (tested on 22) |
| npm | 10+ |
| Supabase project | free tier is enough |
| Vercel account | connected to the GitHub repo |

```bash
npm install
```

---

## 2. Supabase project

### 2.1 Create the project
1. Create a project at <https://supabase.com/dashboard> (any region).
2. In **Project Settings → API Keys** copy:
   - **Project URL** (`SUPABASE_URL`) → `VITE_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_…`, shown as `SUPABASE_PUBLISHABLE_KEY`) → `VITE_SUPABASE_ANON_KEY`
     (older projects show a legacy **anon public** JWT instead — it works the same way)

> Only these two public values are ever used by the frontend. **Never** put the secret key (`sb_secret_…`) / `service_role` key or the JWKS URL in the app, `.env.local`, or Vercel env vars — the app refuses to start if it detects a secret key.

### 2.2 Run the migrations (in order)
Open **SQL Editor** and run each file from `supabase/migrations/`, in this order:

1. `20260926000100_schema.sql` — 17 tables, constraints, indexes, `updated_at` triggers
2. `20260926000200_auth.sql` — `handle_new_user` trigger (auth.users → public.profiles), `login_id_available`, `email_for_login_id`
3. `20260926000300_stock_functions.sql` — all operation RPCs (`create_*`, `update_*`, `mark_ready`, `validate_*`, `cancel_operation`, `init_product_stock`, …)
4. `20260926000400_views.sql` — `v_stock`, `v_product_stock`, `v_move_history`, `v_operations`, `dashboard_kpis()`
5. `20260926000500_rls.sql` — Row Level Security policies

Alternatively with the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`.

Optional demo master data (warehouse WH, locations, categories, products, contacts — **no stock**):
`supabase/seed.sql`. Stock must always enter through operations so the ledger stays complete.

### 2.3 Auth settings — nothing to configure
The app is built for Supabase's **defaults**, so you can skip the Authentication dashboard entirely:

| Default | What happens in StockSense |
| --- | --- |
| **Confirm email = ON** | Sign-up creates the account and shows a *Confirm your email* screen (with *Resend*). Login before confirming shows the same guidance instead of a generic error. After the link is opened the user is signed in / can sign in. |
| **Site URL = `http://localhost:3000`** | Emailed links (confirmation, password reset) return to the Site URL. The dev server therefore runs on **port 3000** so the links land in the running app (`npm run dev`). A password-reset link opens a recovery session; the app routes it to the *Choose a new password* page from any route. |
| **Built-in mailer (no custom SMTP)** | Supabase only delivers to **e-mail addresses of your Supabase organization's team members** and sends at most **~2 e-mails per hour**. Sign up with the address you use for Supabase. Other addresses fail with *Email address not authorized* — the app explains this. |

Consequences to keep in mind:
- Open emailed links in the **same browser** you used to request them (PKCE). If you open one elsewhere, the address is still verified — just sign in normally.
- On the **deployed** (Vercel) app the links still return to `localhost:3000` until the Site URL is changed. The account is confirmed regardless, so users simply go back to the Vercel URL and sign in.
- If you later want judges/teammates to self-register with any address, the two dashboard changes are: **Authentication → SMTP Settings** (custom SMTP) and **Authentication → URL Configuration → Site URL** = your Vercel URL. Neither requires a code change.

---

## 3. Local development

```bash
cp .env.example .env.local   # fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (git-ignored)
npm run dev                  # http://localhost:3000  (Supabase's default Site URL)
```

Without a `.env.local` (or `.env`) the app boots into a "Supabase not configured" screen instead of crashing.

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (0.0.0.0:3000) |
| `npm run build` / `npm run preview` | Production build / serve `dist/` (PWA service worker enabled) |
| `npm run lint` | ESLint (React hooks + React Compiler rules) |
| `npm run test:db` | Runs the SQL migrations inside PGlite and executes the §30 scenarios (107 assertions) |
| `npm run test:ui` | Vitest + Testing Library UI tests against an in-memory Supabase fake (18 tests) |
| `npm test` | Both test suites |
| `npm run icons` | Regenerates PWA icons in `public/` |

---

## 4. Deploy to Vercel

1. Push the repository to GitHub and **Import** it in Vercel (framework preset: *Vite*).
2. Build command `npm run build`, output directory `dist` (defaults).
3. **Environment variables** (Production + Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. `vercel.json` rewrites every route to `index.html` so deep links such as `/receipts/<id>` work.
5. Optional (only if other people must self-register on the deployed app): see the last bullet of 2.3.

Every push to `main` redeploys automatically.

---

## 5. First run

1. Open the app → **Sign up** with the e-mail address of your Supabase account (Login ID 6–12 chars, password > 8 chars with lower/upper/special). Role defaults to *Inventory Manager*.
   Open the confirmation e-mail in the same browser → you land back in the app, signed in (or sign in on the Login page).
2. **Settings → Warehouses**: create `WH` (Main Warehouse), then **Locations**: `A1` Rack A1 and `B2` Rack B2.
3. **Settings → Suppliers & Customers**: add a supplier and a customer (optional).
4. **Products → New product**: e.g. `STL-001` Steel Rod 12mm, reorder level 20.
   (You can enter *initial stock* here — it is recorded through a validated adjustment `WH/ADJ/0001`.)

---

## 6. Demo script (README §24)

| Step | Action | Result |
| --- | --- | --- |
| 1 | Receipts → New: WH / Rack A1, 100 × Steel Rod → Save → **Mark as Ready** → **Validate** | `WH/IN/0001`, stock A1 = 100 |
| 2 | Transfers → New: A1 → B2, 30 × Steel Rod → Ready → Validate | `WH/TR/0001`, A1 = 70, B2 = 30 |
| 3 | Delivery Orders → New: from A1, 20 × Steel Rod → **Check stock & Mark Ready** (reserves 20) → Validate | `WH/OUT/0001`, A1 = 50 |
| 4 | Adjustments → New: A1, counted 47 (reason: damaged) → Ready → Validate | `WH/ADJ/000x` (−3), A1 = 47 |
| 5 | Delivery Orders → New: from B2, 40 × Steel Rod (only 30 free) → Mark Ready | status **WAITING**, no negative stock; becomes READY automatically once stock arrives |

Check **Move History** for the ledger and the **Dashboard** for live KPIs. Total on hand after steps 1–4: 47 + 30 = **77**.

---

## 7. Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Supabase is not configured" screen | `.env.local` missing or URL not `https://…` — restart `npm run dev` after editing it |
| Sign-up says *Error sending confirmation email* / *not authorized* | Built-in mailer only delivers to your Supabase team's addresses (max ~2/hour) — use that address, or configure custom SMTP |
| Login shows *Confirm your email first* | Open the confirmation link (or press *Resend*), then sign in |
| Confirmation link opens `localhost:3000` and nothing loads | The dev server isn't running — start `npm run dev`; the e-mail is already confirmed, so you can also just sign in on the deployed app |
| `function public.create_receipt does not exist` | Migration 3 not applied (run the SQL files in order) |
| Lists are empty although data exists | Migration 5 (RLS) not applied, or the user has no `profiles` row (migration 2 trigger) |
| Vercel 404 on refresh | `vercel.json` missing from the deployed commit |
