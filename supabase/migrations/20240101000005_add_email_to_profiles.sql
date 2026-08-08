-- Add email column to profiles table
alter table public.profiles add column if not exists email text;

-- Update existing profiles with emails from auth.users
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id;

-- Update handle_new_user trigger to populate email automatically
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone_number, email)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone_number',
    new.email
  )
  on conflict (id) do update
  set email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;
