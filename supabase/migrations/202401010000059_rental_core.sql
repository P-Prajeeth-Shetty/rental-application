-- ============================================================
-- Phase 1: Core Rental Tables
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. ALTER PROPERTIES TABLE
-- ────────────────────────────────────────────────────────────
-- Rename units → total_units, add property_type and description, drop occupancy
alter table public.properties rename column units to total_units;
alter table public.properties drop column if exists occupancy;
alter table public.properties add column if not exists property_type text default 'Residential';
alter table public.properties add column if not exists description text;

-- Tighten RLS: only admins can write, everyone authenticated can read
drop policy if exists "Enable read access for all users" on public.properties;
drop policy if exists "Enable insert access for all users" on public.properties;
drop policy if exists "Enable update access for all users" on public.properties;
drop policy if exists "Enable delete access for all users" on public.properties;

create policy "Authenticated users can read properties"
  on public.properties for select using (auth.uid() is not null);
create policy "Admins can insert properties"
  on public.properties for insert with check (public.is_admin());
create policy "Admins can update properties"
  on public.properties for update using (public.is_admin());
create policy "Admins can delete properties"
  on public.properties for delete using (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 2. TENANTS TABLE
-- ────────────────────────────────────────────────────────────
create table public.tenants (
  id uuid default gen_random_uuid() primary key,
  full_name text not null,
  email text,
  phone text,
  id_proof_type text,         -- e.g. Aadhaar, Passport, PAN
  id_proof_number text,
  emergency_contact text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.tenants enable row level security;

create policy "Authenticated users can read tenants"
  on public.tenants for select using (auth.uid() is not null);
create policy "Admins can insert tenants"
  on public.tenants for insert with check (public.is_admin());
create policy "Admins can update tenants"
  on public.tenants for update using (public.is_admin());
create policy "Admins can delete tenants"
  on public.tenants for delete using (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 3. TENANT ASSIGNMENTS (the core relationship)
-- ────────────────────────────────────────────────────────────
create table public.tenant_assignments (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_number text not null,
  current_rent decimal(12,2) not null default 0,
  lease_start date not null,
  lease_end date,
  security_deposit decimal(12,2) default 0,
  status text not null default 'active' check (status in ('active', 'vacated', 'upcoming')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.tenant_assignments enable row level security;

create policy "Authenticated users can read assignments"
  on public.tenant_assignments for select using (auth.uid() is not null);
create policy "Admins can insert assignments"
  on public.tenant_assignments for insert with check (public.is_admin());
create policy "Admins can update assignments"
  on public.tenant_assignments for update using (public.is_admin());
create policy "Admins can delete assignments"
  on public.tenant_assignments for delete using (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 4. RENT REVISIONS (increase/decrease history)
-- ────────────────────────────────────────────────────────────
create table public.rent_revisions (
  id uuid default gen_random_uuid() primary key,
  assignment_id uuid not null references public.tenant_assignments(id) on delete cascade,
  previous_rent decimal(12,2) not null,
  new_rent decimal(12,2) not null,
  increase_pct decimal(6,2),
  effective_from date not null,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.rent_revisions enable row level security;

create policy "Authenticated users can read rent revisions"
  on public.rent_revisions for select using (auth.uid() is not null);
create policy "Admins can insert rent revisions"
  on public.rent_revisions for insert with check (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 5. PAYMENTS TABLE
-- ────────────────────────────────────────────────────────────
create table public.payments (
  id uuid default gen_random_uuid() primary key,
  assignment_id uuid not null references public.tenant_assignments(id) on delete cascade,
  amount decimal(12,2) not null,
  payment_date date not null,
  payment_method text,           -- UPI, Cash, Bank Transfer, Cheque
  period_month integer not null check (period_month between 1 and 12),
  period_year integer not null,
  reference_number text,
  status text not null default 'paid' check (status in ('paid', 'partial', 'pending')),
  notes text,
  upload_batch_id uuid,          -- links to payment_uploads if uploaded via Excel
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.payments enable row level security;

create policy "Authenticated users can read payments"
  on public.payments for select using (auth.uid() is not null);
create policy "Admins can insert payments"
  on public.payments for insert with check (public.is_admin());
create policy "Admins can update payments"
  on public.payments for update using (public.is_admin());
create policy "Admins can delete payments"
  on public.payments for delete using (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 6. PAYMENT UPLOADS (Excel bulk upload tracking)
-- ────────────────────────────────────────────────────────────
create table public.payment_uploads (
  id uuid default gen_random_uuid() primary key,
  file_name text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  record_count integer default 0,
  success_count integer default 0,
  error_count integer default 0,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  error_details jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.payment_uploads enable row level security;

create policy "Admins can read payment uploads"
  on public.payment_uploads for select using (public.is_admin());
create policy "Admins can insert payment uploads"
  on public.payment_uploads for insert with check (public.is_admin());
create policy "Admins can update payment uploads"
  on public.payment_uploads for update using (public.is_admin());

-- Add FK from payments to payment_uploads
alter table public.payments 
  add constraint fk_payments_upload_batch 
  foreign key (upload_batch_id) references public.payment_uploads(id) on delete set null;
