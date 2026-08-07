-- ============================================================
-- Phase: Leased Properties (Taken as Rent)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. LANDLORDS TABLE
-- ────────────────────────────────────────────────────────────
create table public.landlords (
  id uuid default gen_random_uuid() primary key,
  full_name text not null,
  email text,
  phone text,
  pan_number text,
  gst_number text,
  bank_account_name text,
  bank_account_number text,
  bank_ifsc text,
  bank_name text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.landlords enable row level security;

create policy "Authenticated users can read landlords"
  on public.landlords for select using (auth.uid() is not null);
create policy "Admins can insert landlords"
  on public.landlords for insert with check (public.is_admin());
create policy "Admins can update landlords"
  on public.landlords for update using (public.is_admin());
create policy "Admins can delete landlords"
  on public.landlords for delete using (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 2. LEASED PROPERTIES TABLE
-- ────────────────────────────────────────────────────────────
create table public.leased_properties (
  id uuid default gen_random_uuid() primary key,
  landlord_id uuid references public.landlords(id) on delete restrict,
  name text not null,
  address text not null,
  property_type text default 'Commercial',
  total_units integer default 1,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.leased_properties enable row level security;

create policy "Authenticated users can read leased properties"
  on public.leased_properties for select using (auth.uid() is not null);
create policy "Admins can insert leased properties"
  on public.leased_properties for insert with check (public.is_admin());
create policy "Admins can update leased properties"
  on public.leased_properties for update using (public.is_admin());
create policy "Admins can delete leased properties"
  on public.leased_properties for delete using (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 3. LEASE AGREEMENTS TABLE
-- ────────────────────────────────────────────────────────────
create table public.lease_agreements (
  id uuid default gen_random_uuid() primary key,
  property_id uuid not null references public.leased_properties(id) on delete cascade,
  start_date date not null,
  end_date date,
  rent_amount decimal(12,2) not null default 0,
  security_deposit decimal(12,2) default 0,
  status text not null default 'active' check (status in ('active', 'expired', 'terminated')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.lease_agreements enable row level security;

create policy "Authenticated users can read lease agreements"
  on public.lease_agreements for select using (auth.uid() is not null);
create policy "Admins can insert lease agreements"
  on public.lease_agreements for insert with check (public.is_admin());
create policy "Admins can update lease agreements"
  on public.lease_agreements for update using (public.is_admin());
create policy "Admins can delete lease agreements"
  on public.lease_agreements for delete using (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 4. OUTGOING PAYMENTS TABLE
-- ────────────────────────────────────────────────────────────
create table public.outgoing_payments (
  id uuid default gen_random_uuid() primary key,
  agreement_id uuid not null references public.lease_agreements(id) on delete cascade,
  amount decimal(12,2) not null,
  payment_type text not null check (payment_type in ('rent', 'deposit', 'other')),
  payment_date date not null,
  payment_method text,
  reference_number text,
  period_month integer check (period_month between 1 and 12),
  period_year integer,
  status text not null default 'paid' check (status in ('paid', 'pending', 'failed')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.outgoing_payments enable row level security;

create policy "Authenticated users can read outgoing payments"
  on public.outgoing_payments for select using (auth.uid() is not null);
create policy "Admins can insert outgoing payments"
  on public.outgoing_payments for insert with check (public.is_admin());
create policy "Admins can update outgoing payments"
  on public.outgoing_payments for update using (public.is_admin());
create policy "Admins can delete outgoing payments"
  on public.outgoing_payments for delete using (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 5. LEASE RENT REVISIONS TABLE
-- ────────────────────────────────────────────────────────────
create table public.lease_rent_revisions (
  id uuid default gen_random_uuid() primary key,
  agreement_id uuid not null references public.lease_agreements(id) on delete cascade,
  previous_rent decimal(12,2) not null,
  new_rent decimal(12,2) not null,
  increase_pct decimal(6,2),
  effective_from date not null,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.lease_rent_revisions enable row level security;

create policy "Authenticated users can read lease rent revisions"
  on public.lease_rent_revisions for select using (auth.uid() is not null);
create policy "Admins can insert lease rent revisions"
  on public.lease_rent_revisions for insert with check (public.is_admin());
