-- ============================================================
-- Performance: index the foreign-key / filter columns that were
-- never indexed (only primary keys had indexes), and add a
-- pre-aggregated payments view so payment-stats no longer has to
-- pull every payment row into the edge function to compute totals.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Indexes on columns actually used in joins / .eq() / .in()
--    filters across TenantsView, LeasesView, payment-stats,
--    process-payments and auto-rent-increase.
-- ────────────────────────────────────────────────────────────
create index if not exists idx_payments_assignment_id on public.payments(assignment_id);
create index if not exists idx_payments_period on public.payments(period_year, period_month);

create index if not exists idx_tenant_assignments_tenant_id on public.tenant_assignments(tenant_id);
create index if not exists idx_tenant_assignments_property_id on public.tenant_assignments(property_id);
create index if not exists idx_tenant_assignments_status on public.tenant_assignments(status);

create index if not exists idx_rent_revisions_assignment_id on public.rent_revisions(assignment_id);

-- ────────────────────────────────────────────────────────────
-- 2. Pre-aggregated payments-by-period view.
--
-- payment-stats previously fetched every row of `payments` on every
-- dashboard load and monthly-status check, then summed them in JS.
-- This view does the same sum (grouped by assignment + month + year)
-- in indexed SQL, so the edge function receives one row per
-- tenant-month instead of one row per payment record. `security_invoker`
-- makes the view respect the querying user's RLS on `payments` rather
-- than running as the view owner.
-- ────────────────────────────────────────────────────────────
create or replace view public.payments_period_summary
  with (security_invoker = true) as
select
  assignment_id,
  period_month,
  period_year,
  coalesce(sum(amount) filter (
    where payment_type is null or payment_type in ('rent', 'historical_settlement')
  ), 0) as rent_paid,
  coalesce(sum(amount) filter (where payment_type = 'security_deposit'), 0) as deposit_paid,
  count(*) filter (
    where payment_type is null or payment_type in ('rent', 'historical_settlement')
  ) as rent_payment_count
from public.payments
where is_reversed = false
group by assignment_id, period_month, period_year;

grant select on public.payments_period_summary to authenticated;
