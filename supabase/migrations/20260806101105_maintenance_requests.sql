create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  property_id uuid references public.properties(id) on delete set null,
  unit_number text,
  priority text check (priority in ('Low', 'Medium', 'High')),
  status text check (status in ('Reported', 'In Progress', 'Resolved')) default 'Reported',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.maintenance_requests enable row level security;

-- Create policy to allow all authenticated users (property managers) to manage maintenance requests
create policy "Allow all authenticated users full access to maintenance_requests"
  on public.maintenance_requests
  for all
  to authenticated
  using (true)
  with check (true);

-- Insert some dummy data for the visual mockup
insert into public.maintenance_requests (title, unit_number, priority, status) values
  ('Leaking Faucet', '4B', 'Medium', 'Reported'),
  ('Broken Window', '12', 'High', 'Reported'),
  ('HVAC Repair', '101A', 'High', 'In Progress'),
  ('Clogged Sink', '3C', 'Low', 'Resolved'),
  ('Light Fixture Replacement', '2A', 'Low', 'Resolved');
