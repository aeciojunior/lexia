
SELECT cron.schedule(
  'invoice-notifications-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://dnpakncqtzjdtkwcjpsw.supabase.co/functions/v1/invoice-notifications',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_anon_key', true), '')),
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) AS request_id;
  $$
);
