-- Notify a tenant by email when a real (non-backfill) rent/maintenance payment is recorded.
-- payment_type = 'historical_settlement' rows are excluded: those are one-time catch-up
-- entries used when migrating an existing tenant into the app (see tenant migration flow)
-- and would otherwise flood a migrated tenant with dozens of backdated receipt emails.
create extension if not exists pg_net;

create or replace function public.notify_payment_received()
returns trigger as $$
begin
  if new.status = 'paid' and new.payment_type is distinct from 'historical_settlement' then
    perform net.http_post(
      url := 'https://' || current_setting('request.jwt.aud', true) || '/functions/v1/send-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('request.jwt.secret', true)
      ),
      body := jsonb_build_object(
        'event', 'payment_received',
        'payment_id', new.id
      )
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_payment_received_notify on public.payments;

create trigger on_payment_received_notify
  after insert on public.payments
  for each row execute procedure public.notify_payment_received();
