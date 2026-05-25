-- Schedule client-notifications to run every 2 hours
SELECT cron.schedule(
  'client-notifications-every-2h',
  '30 */2 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://dnpakncqtzjdtkwcjpsw.supabase.co/functions/v1/client-notifications',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_anon_key', true), '')),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
