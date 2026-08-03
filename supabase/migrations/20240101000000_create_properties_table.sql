create table public.properties (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  address text not null,
  units integer not null default 0,
  occupancy integer not null default 0,
  image text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.properties enable row level security;

-- Create basic policies (Allow everything for anon for local dev, you'll want to lock this down in production)
create policy "Enable read access for all users" on public.properties for select using (true);
create policy "Enable insert access for all users" on public.properties for insert with check (true);
create policy "Enable update access for all users" on public.properties for update using (true);
create policy "Enable delete access for all users" on public.properties for delete using (true);
