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
2. In **Project Settings → API** copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

> Only these two public values are ever used by the frontend. **Never** put the `service_role` key in the app, `.env`, or Vercel env vars.

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

### 2.3 Auth settings
**Authentication → Providers → Email**
- For a hackathon demo, turn **Confirm email** *off* so sign-up logs in immediately.
  (If you keep it on, users must click the confirmation link before their first login.)

**Authentication → URL Configuration**
- Site URL: your Vercel URL (e.g. `https://stocksense.vercel.app`)
- Redirect URLs: add `http://localhost:5173/**` and `https://<your-vercel-domain>/**`

Password reset supports both e-mail flows: the **link** in the default "Reset Password" template works out of the box
(open it in the same browser that requested the reset — PKCE), and if you also want the **6-digit code** option shown on the
reset page, add `{{ .Token }}` to that template (**Authentication → Emails → Reset Password**).

---

## 3. Local development

```bash
cp .env.example .env.local   # fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (git-ignored)
npm run dev                  # http://localhost:5173
```

Without a `.env.local` (or `.env`) the app boots into a "Supabase not configured" screen instead of crashing.

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (0.0.0.0:5173) |
| `npm run build` / `npm run preview` | Production build / serve `dist/` (PWA service worker enabled) |
| `npm run lint` | ESLint (React hooks + React Compiler rules) |
| `npm run test:db` | Runs the SQL migrations inside PGlite and executes the §30 scenarios (107 assertions) |
| `npm run test:ui` | Vitest + Testing Library UI tests against an in-memory Supabase fake (14 tests) |
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
5. Add the Vercel domain to Supabase **Redirect URLs** (see 2.3).

Every push to `main` redeploys automatically.

---

## 5. First run

1. Open the app → **Sign up** (Login ID 6–12 chars, password > 8 chars with lower/upper/special). Role defaults to *Inventory Manager*.
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
| Sign-up succeeds but login says *Invalid Login ID or Password* | Email confirmation is on — confirm the e-mail or disable *Confirm email* |
| `function public.create_receipt does not exist` | Migration 3 not applied (run the SQL files in order) |
| Lists are empty although data exists | Migration 5 (RLS) not applied, or the user has no `profiles` row (migration 2 trigger) |
| Vercel 404 on refresh | `vercel.json` missing from the deployed commit |
