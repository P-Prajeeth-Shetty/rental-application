create table public.user_roles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('admin', 'user')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id)
);

-- Enable RLS
alter table public.user_roles enable row level security;

-- Policies for user_roles
-- 1. Users can read their own role
create policy "Users can read own role"
on public.user_roles
for select
using (auth.uid() = user_id);

-- 2. Admins can read all roles
create policy "Admins can read all roles"
on public.user_roles
for select
using (
  exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  )
);

-- 3. Only admins can insert/update/delete roles
create policy "Admins can insert roles"
on public.user_roles
for insert
with check (
  exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  )
);

create policy "Admins can update roles"
on public.user_roles
for update
using (
  exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  )
);

create policy "Admins can delete roles"
on public.user_roles
for delete
using (
  exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  )
);
