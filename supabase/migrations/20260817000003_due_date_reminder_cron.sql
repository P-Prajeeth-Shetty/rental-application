-- Daily cron job that invokes check-due-reminders, which itself no-ops unless
-- today is exactly 3 days before the 1st of next month (rent is always due on
-- the 1st — see supabase/functions/_shared/rentCalc.ts computeDueDate).
create extension if not exists pg_net;
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'daily-due-reminder-check') then
    perform cron.unschedule('daily-due-reminder-check');
  end if;
end $$;

select cron.schedule(
  'daily-due-reminder-check',
  '0 9 * * *',
  $$
    select net.http_post(
      url:='https://' || current_setting('request.jwt.aud', true) || '/functions/v1/check-due-reminders',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('request.jwt.secret', true)
      ),
      body:='{}'::jsonb
    );
  $$
);
