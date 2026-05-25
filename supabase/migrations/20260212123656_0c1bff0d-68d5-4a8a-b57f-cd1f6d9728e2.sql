-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Schedule deadline notifications every hour
SELECT cron.schedule(
  'deadline-notifications-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dnpakncqtzjdtkwcjpsw.supabase.co/functions/v1/deadline-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_anon_key', true), '')),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);