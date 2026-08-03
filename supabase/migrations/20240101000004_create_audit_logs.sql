-- ============================================================
-- Audit Logs Table
-- ============================================================
create table public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  admin_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  details jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.audit_logs enable row level security;

-- Only admins can read audit logs
create policy "Admins can read audit logs"
on public.audit_logs
for select
using (public.is_admin());

-- Service role (edge functions) can insert logs — no RLS restriction needed
-- since edge functions use the service role key which bypasses RLS

-- ============================================================
-- Tighten Profiles RLS: Remove user self-edit ability
-- Regular users should only VIEW profiles, not edit them
-- ============================================================
drop policy if exists "Users can update their own profile" on public.profiles;

-- Admins retain full update rights (already exists from migration 000003)
-- No other update policies remain, so only admins can edit profiles
