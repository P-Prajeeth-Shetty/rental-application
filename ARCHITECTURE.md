# Architecture

This document maps the codebase for contributors: what each part does and how the pieces connect. For setup instructions, see [README.md](README.md).

## Stack

- **Frontend**: React 19 + TypeScript, built with Vite
- **Styling**: hand-written CSS per view/component (no CSS framework), shared tokens in `src/styles/design-system.css`
- **Charts**: Recharts
- **Icons**: lucide-react
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions + `pg_cron`)
- **Lint**: oxlint (`.oxlintrc.json`)

## High-level shape

```
src/
  App.tsx              — auth/session bootstrap, role fetch, view router (switch, no library)
  views/                — one file per top-level screen, wired into App.tsx's switch
  components/
    layout/             — app shell: sidebar, header, profile modals, clock widget
    dashboard/           — KPI tiles, charts, widgets used only by DashboardView
    ui/                  — generic building blocks: Modal/Drawer, CustomSelect, CustomDatePicker
    agreement/           — printable lease agreement slip
  hooks/                — useTenants (data/mutations), useCurrentProfile, useDarkMode
  contexts/             — NotificationContext (reminders + notebooks, polls every 10s)
  lib/                  — supabase client, paymentUtils (badges), storageUtils (uploads)
  types/                — leased.ts (landlord/lease domain types)

supabase/
  functions/            — Deno edge functions (see below)
  functions/_shared/    — rentCalc.ts: the one source of truth for rent-date math
  migrations/           — schema history, chronological
```

There is no router library — `App.tsx` holds `activeView` in state and renders views via a `switch`. There is no server-side framework; Supabase Postgres (with RLS) is the backend, fronted by edge functions where privileged or cross-cutting logic is needed.

## Views

| View | Purpose |
|---|---|
| `LoginView` | Email/password sign-in via `supabase.auth.signInWithPassword` |
| `DashboardView` | KPI grid, revenue/donut/line/area charts, overdue alerts, recent activity, calendar |
| `PropertiesView` | CRUD for owned properties; toggles into `LeasedPropertiesView` for the "leased-in" side |
| `TenantsView` | Tenant + lease-assignment CRUD, rent revisions, vacate/transfer, payment ledger (via `useTenants`) |
| `LeasesView` | Active lease list with payments, receipt uploads, timing/rent badges |
| `LeasedPropertiesView` | Properties the business leases *from* landlords: landlords, agreements, outgoing payments, agreement slip printing |
| `MaintenanceBillingView` | Per-property maintenance bills, equal/custom split across tenants, charge tracking |
| `ReportsView` | Aggregated rent KPIs, per-assignment status, revenue chart |
| `UsersView` | Admin-only user management via edge functions (`admin-create-user`, `admin-manage-user`) |
| `HelpCenterView` | Static help content |

## Auth & roles

Roles are binary: **`admin`** or **`user`** — there is no manager/viewer tier. After login, `App.tsx` looks up the caller's row in `user_roles`, defaulting to `'user'` if none exists. Only `userRole === 'admin'` can reach `UsersView`; the switch falls back to `DashboardView` otherwise.

RLS on `user_roles` uses an `is_admin()` `security definer` function (`20240101000002_fix_user_roles_rls.sql`) to avoid recursive-policy issues. Privileged edge functions (`admin-create-user`, `admin-manage-user`) re-verify the caller is admin server-side before using the service-role key — the client-side gate is UX only, not the security boundary.

## Supabase edge functions

| Function | Role |
|---|---|
| `payment-stats` | Dashboard/report KPIs, overdue lists — uses `_shared/rentCalc.ts` |
| `process-payments` | Records incoming payments, classifies timing, computes GST/TDS via `_shared/rentCalc.ts` |
| `auto-rent-increase` | Daily `pg_cron` job applying the 5%/11-month rent escalation (see below) |
| `clean-revisions` | One-off cleanup for erroneous future `rent_revisions` rows from a past bug |
| `admin-create-user` / `admin-manage-user` | Admin-gated user lifecycle (create/edit/delete/change password) |
| `process-reminders` | Scans `reminders` for due items, run via `pg_cron` |
| `properties-handler` | REST-style CRUD for `properties` under the caller's RLS session |

`_shared/rentCalc.ts` centralizes due-date computation, timing classification, day-prorated expected rent (revision-aware), and net-payable (GST/TDS) math specifically so `payment-stats` and `process-payments` can't drift apart — see commit `7be86e0`.

## Key business rules

**Rent escalation** — 5% increase every 11 months from lease start (or the last revision), applied by `auto-rent-increase` and mirrored client-side by `rentBadge()` in `paymentUtils.ts` for display ("Base Rent" vs "Escalated +N%"). The cron job simulates forward per-assignment to catch up multiple missed cycles in one run.

**Deposit separation** — `security_deposit` is a dedicated column on `tenant_assignments`, and `'security_deposit'` is its own `payment_type` value on `payments` (alongside `rent`, `advance`, `adjustment`, `penalty`, `maintenance`, `historical_settlement`) — deposits are never folded into rent math. The leased-in domain mirrors this with `lease_agreements.security_deposit` / `outgoing_payments`.

**Timing badges** — payments are classified early/on-time/late relative to `due_day` + `grace_days` on the assignment, computed both server-side (`rentCalc.ts`) and client-side (`paymentUtils.ts`) for display.

## Database migrations

Chronological; see `supabase/migrations/`. Notable waypoints:

- `202401010000059_rental_core.sql` — core schema: `tenants`, `tenant_assignments`, `rent_revisions`, `payments`
- `20260807000000_leased_properties.sql` — "leased-in" domain: `landlords`, `leased_properties`, `lease_agreements`, `outgoing_payments`
- `20260810000001_maintenance_billing.sql` — replaces early ticket-based maintenance tables with the current billing module
- `20260814000000_auto_rent_increase_cron.sql` — enables `pg_net`/`pg_cron`, schedules the daily rent-escalation job
- `20260815000001_add_performance_indexes_and_payment_summary.sql` — indexes + pre-aggregated summary view backing `payment-stats`

## Conventions worth knowing

- Views own their data fetching directly via the Supabase client, except `TenantsView`, which delegates to `useTenants` for shared fetch/mutation logic.
- CSS is per-file (`*.css` next to the view/component group it styles), with shared design tokens (spacing, radii, colors) in `src/styles/design-system.css` — prefer the tokens over hardcoded values in new CSS.
- Storage uploads (`storageUtils.ts`) use two private buckets: `payment_receipts` and `tenant_documents`, both accessed via signed URLs.
