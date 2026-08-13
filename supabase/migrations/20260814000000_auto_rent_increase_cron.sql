-- Enable necessary extensions if not already enabled
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Unschedule existing job if we are replacing it
select cron.unschedule('daily-auto-rent-increase');

-- Schedule a daily job at midnight (UTC) to trigger the auto-rent-increase edge function
select cron.schedule(
  'daily-auto-rent-increase',
  '0 0 * * *',
  $$
    select net.http_post(
      url:='https://' || current_setting('request.jwt.aud', true) || '/functions/v1/auto-rent-increase',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('request.jwt.secret', true)
      ),
      body:='{}'::jsonb
    );
  $$
);
