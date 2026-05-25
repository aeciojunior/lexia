-- Schedule court-sync to run every 6 hours for all active integrations
SELECT cron.schedule(
  'court-sync-every-6h',
  '0 */6 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://dnpakncqtzjdtkwcjpsw.supabase.co/functions/v1/court-sync',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_anon_key', true), '')),
      body := '{"sync_all": true}'::jsonb
    ) AS request_id;
  $$
);
