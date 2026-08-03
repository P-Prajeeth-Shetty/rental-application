-- ============================================================
-- Phase 2: Bulletproof Payments System
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TENANT_ASSIGNMENTS — add payment_mode, due_day, grace_days
-- ────────────────────────────────────────────────────────────

alter table public.tenant_assignments
  add column if not exists payment_mode text default 'prepaid'
    check (payment_mode in ('prepaid', 'postpaid', 'advance_on_entry'));

alter table public.tenant_assignments
  add column if not exists due_day integer default 1
    check (due_day >= 1 and due_day <= 28);

alter table public.tenant_assignments
  add column if not exists grace_days integer default 5
    check (grace_days >= 0 and grace_days <= 30);

-- ────────────────────────────────────────────────────────────
-- 2. PAYMENTS TABLE — new tracking columns
-- ────────────────────────────────────────────────────────────

alter table public.payments
  add column if not exists payment_type text default 'rent'
    check (payment_type in ('rent', 'security_deposit', 'advance', 'adjustment', 'penalty'));

alter table public.payments
  add column if not exists payment_timing text default 'unknown'
    check (payment_timing in ('early', 'on_time', 'late', 'unknown'));

alter table public.payments
  add column if not exists days_late integer default 0;

alter table public.payments
  add column if not exists credit_amount numeric(12, 2) default 0;
  -- positive = overpayment credit, negative = underpayment outstanding

alter table public.payments
  add column if not exists expected_amount numeric(12, 2);
  -- snapshot of the rent at time of payment for historical accuracy

alter table public.payments
  add column if not exists is_reversed boolean default false;

alter table public.payments
  add column if not exists reversal_notes text;

-- ────────────────────────────────────────────────────────────
-- 3. TENANT CREDIT BALANCE VIEW
-- Running credit/outstanding balance per tenant
-- ────────────────────────────────────────────────────────────

create or replace view public.tenant_credit_balance as
select
  ta.tenant_id,
  t.full_name,
  ta.id as assignment_id,
  ta.property_id,
  p.name as property_name,
  ta.unit_number,
  coalesce(sum(
    case
      when pay.is_reversed = true then 0
      else pay.credit_amount
    end
  ), 0) as credit_balance,
  count(case when pay.payment_timing = 'late' and pay.is_reversed = false then 1 end) as late_payment_count,
  count(case when pay.is_reversed = false then 1 end) as total_payments
from public.tenant_assignments ta
join public.tenants t on t.id = ta.tenant_id
join public.properties p on p.id = ta.property_id
left join public.payments pay on pay.assignment_id = ta.id
where ta.status = 'active'
group by ta.tenant_id, t.full_name, ta.id, ta.property_id, p.name, ta.unit_number;
