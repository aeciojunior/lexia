
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule task notifications check every hour
SELECT cron.schedule(
  'task-due-notifications',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dnpakncqtzjdtkwcjpsw.supabase.co/functions/v1/task-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_anon_key', true), '')),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
