-- ============================================================
-- Create Expenses Table
-- ============================================================

create table public.expenses (
  id uuid default gen_random_uuid() primary key,
  property_id uuid references public.properties(id) on delete cascade, -- Optional, can be null for general business expenses
  category text not null check (category in ('maintenance', 'utilities', 'marketing', 'insurance', 'taxes', 'other')),
  amount numeric(12, 2) not null,
  expense_date date not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.expenses enable row level security;

create policy "Authenticated users can read expenses"
  on public.expenses for select using (auth.uid() is not null);
create policy "Admins can insert expenses"
  on public.expenses for insert with check (public.is_admin());
create policy "Admins can update expenses"
  on public.expenses for update using (public.is_admin());
create policy "Admins can delete expenses"
  on public.expenses for delete using (public.is_admin());
