-- ============================================================
-- Maintenance Billing Module Migration
-- ============================================================

-- 1. Clean up old maintenance ticketing system
DROP TABLE IF EXISTS public.maintenance_comments CASCADE;
DROP TABLE IF EXISTS public.maintenance_requests CASCADE;

-- 2. Create maintenance_bills table (Property Level)
CREATE TABLE IF NOT EXISTS public.maintenance_bills (
  id uuid default gen_random_uuid() primary key,
  property_id uuid references public.properties(id) on delete cascade not null,
  total_amount numeric(12,2) not null check (total_amount >= 0),
  billing_month int not null check (billing_month between 1 and 12),
  billing_year int not null,
  description text,
  split_type text not null check (split_type in ('equal', 'custom')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references auth.users(id) on delete set null
);

-- 3. Create maintenance_charges table (Tenant Level)
CREATE TABLE IF NOT EXISTS public.maintenance_charges (
  id uuid default gen_random_uuid() primary key,
  bill_id uuid references public.maintenance_bills(id) on delete cascade not null,
  assignment_id uuid references public.tenant_assignments(id) on delete cascade not null,
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Enable RLS
ALTER TABLE public.maintenance_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_charges ENABLE ROW LEVEL SECURITY;

-- 5. Create Policies (Full access for authenticated users/managers)
CREATE POLICY "Allow all authenticated users full access to maintenance_bills"
  ON public.maintenance_bills FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow all authenticated users full access to maintenance_charges"
  ON public.maintenance_charges FOR ALL TO authenticated USING (true);
