-- ────────────────────────────────────────────────────────────
-- Payment Transactions: stores the raw, un-split payment
-- exactly as entered by the user.  Each row in `payments`
-- (the monthly split) links back here via `transaction_id`.
-- ────────────────────────────────────────────────────────────

-- 1. Create payment_transactions table
create table if not exists public.payment_transactions (
  id            uuid default gen_random_uuid() primary key,
  assignment_id uuid not null references public.tenant_assignments(id) on delete cascade,
  amount        numeric not null,
  payment_date  date not null,
  payment_method text,
  payment_type  text not null default 'rent',
  reference_number text,
  receipt_url   text,
  notes         text,
  months_covered integer not null default 1,
  created_at    timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. RLS
alter table public.payment_transactions enable row level security;

create policy "Authenticated users can read payment_transactions"
  on public.payment_transactions for select using (auth.uid() is not null);

create policy "Admins can insert payment_transactions"
  on public.payment_transactions for insert with check (public.is_admin());

create policy "Admins can update payment_transactions"
  on public.payment_transactions for update using (public.is_admin());

create policy "Admins can delete payment_transactions"
  on public.payment_transactions for delete using (public.is_admin());

-- 3. Add transaction_id FK on the existing payments table
alter table public.payments
  add column if not exists transaction_id uuid references public.payment_transactions(id) on delete set null;

-- 4. Index for fast lookups
create index if not exists idx_payment_transactions_assignment
  on public.payment_transactions(assignment_id);

create index if not exists idx_payments_transaction_id
  on public.payments(transaction_id);
