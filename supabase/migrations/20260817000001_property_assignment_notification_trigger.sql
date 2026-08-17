-- Notify a tenant by email when they're assigned to a property.
create extension if not exists pg_net;

create or replace function public.notify_property_assigned()
returns trigger as $$
begin
  if new.status = 'active' then
    perform net.http_post(
      url := 'https://' || current_setting('request.jwt.aud', true) || '/functions/v1/send-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('request.jwt.secret', true)
      ),
      body := jsonb_build_object(
        'event', 'property_assigned',
        'assignment_id', new.id
      )
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_property_assigned_notify on public.tenant_assignments;

create trigger on_property_assigned_notify
  after insert on public.tenant_assignments
  for each row execute procedure public.notify_property_assigned();
