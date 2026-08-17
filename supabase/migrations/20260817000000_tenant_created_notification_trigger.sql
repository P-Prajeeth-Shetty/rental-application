-- Notify a tenant by email when they're first added to the system.
create extension if not exists pg_net;

create or replace function public.notify_tenant_created()
returns trigger as $$
begin
  perform net.http_post(
    url := 'https://' || current_setting('request.jwt.aud', true) || '/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('request.jwt.secret', true)
    ),
    body := jsonb_build_object(
      'event', 'tenant_created',
      'tenant_id', new.id
    )
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_tenant_created_notify on public.tenants;

create trigger on_tenant_created_notify
  after insert on public.tenants
  for each row execute procedure public.notify_tenant_created();
