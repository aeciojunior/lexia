SELECT cron.schedule(
  'court-monitoring-scan-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url:='https://dnpakncqtzjdtkwcjpsw.supabase.co/functions/v1/court-monitoring-scan',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_anon_key', true), '')),
    body:='{}'::jsonb
  ) AS request_id;
  $$
);