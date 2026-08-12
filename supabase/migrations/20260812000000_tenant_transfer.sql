-- ============================================================
-- Phase: Tenant Property Transfer
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. LINK COLUMNS ON TENANT_ASSIGNMENTS
-- ────────────────────────────────────────────────────────────
alter table public.tenant_assignments
  add column if not exists previous_assignment_id uuid references public.tenant_assignments(id) on delete set null;

alter table public.tenant_assignments
  add column if not exists transfer_reason text;

-- ────────────────────────────────────────────────────────────
-- 2. ATOMIC TRANSFER FUNCTION
-- Vacates the old assignment and creates the new one in a single
-- transaction, so a tenant can never end up with the old assignment
-- vacated but no new assignment created (or vice versa). Historical
-- payments stay attached to the old assignment_id/property_id — this
-- function never mutates property_id on an existing row.
-- ────────────────────────────────────────────────────────────
create or replace function public.transfer_tenant_assignment(
  p_old_assignment_id uuid,
  p_transfer_date date,
  p_new_property_id uuid,
  p_new_unit_number text,
  p_new_rent numeric,
  p_new_deposit numeric,
  p_new_lease_end date,
  p_payment_mode text,
  p_due_day integer,
  p_grace_days integer,
  p_gst_rate numeric,
  p_tds_rate numeric,
  p_reason text
) returns public.tenant_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.tenant_assignments;
  v_new public.tenant_assignments;
begin
  if not public.is_admin() then
    raise exception 'Only admins can transfer a tenant to another property';
  end if;

  select * into v_old from public.tenant_assignments where id = p_old_assignment_id for update;

  if v_old.id is null then
    raise exception 'Assignment not found';
  end if;

  if v_old.status <> 'active' then
    raise exception 'Only an active assignment can be transferred';
  end if;

  update public.tenant_assignments
    set status = 'vacated', lease_end = p_transfer_date
    where id = p_old_assignment_id;

  insert into public.tenant_assignments (
    tenant_id, property_id, unit_number, current_rent, lease_start, lease_end,
    security_deposit, status, payment_mode, due_day, grace_days, gst_rate, tds_rate,
    previous_assignment_id, transfer_reason
  ) values (
    v_old.tenant_id, p_new_property_id, p_new_unit_number, p_new_rent, p_transfer_date, p_new_lease_end,
    p_new_deposit, 'active', p_payment_mode, p_due_day, p_grace_days, p_gst_rate, p_tds_rate,
    p_old_assignment_id, p_reason
  )
  returning * into v_new;

  return v_new;
end;
$$;

grant execute on function public.transfer_tenant_assignment(
  uuid, date, uuid, text, numeric, numeric, date, text, integer, integer, numeric, numeric, text
) to authenticated;
