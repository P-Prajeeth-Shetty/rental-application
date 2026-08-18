-- Fix all notification triggers that use broken current_setting() calls.
-- The url was resolving to NULL because 'request.jwt.aud' is not a valid
-- GUC for constructing the Supabase project URL, causing a 23502 NOT NULL
-- violation inside net.http_post().
--
-- Fix: hardcode the project URL from the Supabase config.

-- 1. Fix tenant created notification
create or replace function public.notify_tenant_created()
returns trigger as $$
begin
  perform net.http_post(
    url := 'https://oaafrqjsoiqimdvunmhk.supabase.co/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := jsonb_build_object(
      'event', 'tenant_created',
      'tenant_id', new.id
    )
  );
  return new;
exception when others then
  -- Don't let notification failures block the insert
  raise warning 'notify_tenant_created failed: %', sqlerrm;
  return new;
end;
$$ language plpgsql security definer;

-- 2. Fix property assignment notification
create or replace function public.notify_property_assigned()
returns trigger as $$
begin
  if new.status = 'active' then
    perform net.http_post(
      url := 'https://oaafrqjsoiqimdvunmhk.supabase.co/functions/v1/send-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
      ),
      body := jsonb_build_object(
        'event', 'property_assigned',
        'assignment_id', new.id
      )
    );
  end if;
  return new;
exception when others then
  raise warning 'notify_property_assigned failed: %', sqlerrm;
  return new;
end;
$$ language plpgsql security definer;

-- 3. Fix payment receipt notification
create or replace function public.notify_payment_received()
returns trigger as $$
begin
  if new.status = 'paid' and new.payment_type is distinct from 'historical_settlement' then
    perform net.http_post(
      url := 'https://oaafrqjsoiqimdvunmhk.supabase.co/functions/v1/send-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
      ),
      body := jsonb_build_object(
        'event', 'payment_received',
        'payment_id', new.id
      )
    );
  end if;
  return new;
exception when others then
  raise warning 'notify_payment_received failed: %', sqlerrm;
  return new;
end;
$$ language plpgsql security definer;
