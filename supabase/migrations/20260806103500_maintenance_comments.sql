create table if not exists public.maintenance_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.maintenance_requests(id) on delete cascade not null,
  content text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.maintenance_comments enable row level security;

-- Allow all authenticated users full access
create policy "Allow all authenticated users full access to maintenance_comments"
  on public.maintenance_comments
  for all
  to authenticated
  using (true)
  with check (true);
