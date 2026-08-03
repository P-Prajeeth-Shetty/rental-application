-- Create a security definer function to check if the current user is an admin
-- This bypasses RLS on user_roles to prevent infinite recursion
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- Drop the old recursive policies
drop policy if exists "Admins can read all roles" on public.user_roles;
drop policy if exists "Admins can insert roles" on public.user_roles;
drop policy if exists "Admins can update roles" on public.user_roles;
drop policy if exists "Admins can delete roles" on public.user_roles;

-- Recreate policies using the secure function
create policy "Admins can read all roles"
on public.user_roles
for select
using (public.is_admin());

create policy "Admins can insert roles"
on public.user_roles
for insert
with check (public.is_admin());

create policy "Admins can update roles"
on public.user_roles
for update
using (public.is_admin());

create policy "Admins can delete roles"
on public.user_roles
for delete
using (public.is_admin());
