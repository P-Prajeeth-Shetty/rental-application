-- ============================================================
-- Enforce: distinct unit_number count per property ≤ total_units
-- ============================================================
-- This trigger fires BEFORE INSERT or UPDATE on tenant_assignments.
-- It counts the number of *distinct* active unit_numbers already
-- assigned to the target property. If the new row introduces a
-- unit_number that does not yet exist AND the property is already
-- at capacity, the INSERT/UPDATE is rejected.
--
-- Note: multiple tenants sharing the SAME unit_number is allowed
-- (e.g. two tenants in 522-G). Only creating a brand-new unit
-- name beyond total_units is blocked.
-- ============================================================

create or replace function public.check_unit_count_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_units integer;
  v_existing_count integer;
  v_unit_exists boolean;
begin
  -- Only enforce for active assignments
  if NEW.status <> 'active' then
    return NEW;
  end if;

  -- Get the property's total_units cap
  select total_units into v_total_units
    from public.properties
    where id = NEW.property_id;

  if v_total_units is null then
    raise exception 'Property not found';
  end if;

  -- Check if this exact unit_number already exists for the property
  -- (among active assignments, excluding our own row on UPDATE)
  select exists(
    select 1 from public.tenant_assignments
    where property_id = NEW.property_id
      and status = 'active'
      and lower(unit_number) = lower(NEW.unit_number)
      and id is distinct from NEW.id
  ) into v_unit_exists;

  -- If the unit already exists, allow it (shared unit)
  if v_unit_exists then
    return NEW;
  end if;

  -- Count how many distinct unit names are already in use
  select count(distinct lower(unit_number)) into v_existing_count
    from public.tenant_assignments
    where property_id = NEW.property_id
      and status = 'active'
      and id is distinct from NEW.id;

  -- If adding this new unit name would exceed the cap, reject
  if v_existing_count >= v_total_units then
    raise exception 'Property already has % / % unit names assigned. Cannot add a new unit. Pick an existing unit or increase the property''s total_units.', v_existing_count, v_total_units;
  end if;

  return NEW;
end;
$$;

-- Drop existing trigger if it exists, then create
drop trigger if exists trg_check_unit_count on public.tenant_assignments;

create trigger trg_check_unit_count
  before insert or update on public.tenant_assignments
  for each row
  execute function public.check_unit_count_limit();
