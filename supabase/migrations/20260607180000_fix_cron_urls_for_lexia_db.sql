-- Re-point pg_cron jobs to the lexia-db Supabase project
DO $$
DECLARE
  base_url text := 'https://vnxuibjgayhmcitpjmde.supabase.co/functions/v1/';
  auth_header jsonb := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_anon_key', true), '')
  );
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job
  WHERE jobname IN (
    'deadline-notifications-hourly',
    'task-due-notifications',
    'invoice-notifications-hourly',
    'movement-notifications-hourly',
    'client-notifications-every-2h',
    'court-sync-every-6h',
    'execute-automations-hourly',
    'court-monitoring-scan-daily'
  );
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'deadline-notifications-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vnxuibjgayhmcitpjmde.supabase.co/functions/v1/deadline-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_anon_key', true), '')),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'task-due-notifications',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vnxuibjgayhmcitpjmde.supabase.co/functions/v1/task-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_anon_key', true), '')),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'invoice-notifications-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vnxuibjgayhmcitpjmde.supabase.co/functions/v1/invoice-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_anon_key', true), '')),
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'movement-notifications-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vnxuibjgayhmcitpjmde.supabase.co/functions/v1/movement-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_anon_key', true), '')),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'client-notifications-every-2h',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vnxuibjgayhmcitpjmde.supabase.co/functions/v1/client-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_anon_key', true), '')),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'court-sync-every-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vnxuibjgayhmcitpjmde.supabase.co/functions/v1/court-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_anon_key', true), '')),
    body := '{"sync_all": true}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'execute-automations-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vnxuibjgayhmcitpjmde.supabase.co/functions/v1/execute-automations',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_anon_key', true), '')),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'court-monitoring-scan-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vnxuibjgayhmcitpjmde.supabase.co/functions/v1/court-monitoring-scan',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.supabase_anon_key', true), '')),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
