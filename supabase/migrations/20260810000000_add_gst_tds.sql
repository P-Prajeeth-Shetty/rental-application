-- ============================================================
-- GST & TDS Support for Tenant Assignments and Payments
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TENANT_ASSIGNMENTS — add gst_rate, tds_rate
-- ────────────────────────────────────────────────────────────

alter table public.tenant_assignments
  add column if not exists gst_rate numeric(5,2) default 18
    check (gst_rate >= 0 and gst_rate <= 100);

alter table public.tenant_assignments
  add column if not exists tds_rate numeric(5,2) default 10
    check (tds_rate >= 0 and tds_rate <= 100);

-- ────────────────────────────────────────────────────────────
-- 2. PAYMENTS — snapshot GST/TDS amounts at payment time
-- ────────────────────────────────────────────────────────────

alter table public.payments
  add column if not exists gst_amount numeric(12,2) default 0;

alter table public.payments
  add column if not exists tds_amount numeric(12,2) default 0;

-- ────────────────────────────────────────────────────────────
-- 3. RENT_REVISIONS — optional GST/TDS rate overrides
-- ────────────────────────────────────────────────────────────

alter table public.rent_revisions
  add column if not exists new_gst_rate numeric(5,2);

alter table public.rent_revisions
  add column if not exists new_tds_rate numeric(5,2);
