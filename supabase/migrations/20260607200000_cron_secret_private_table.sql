-- Store cron secret in DB (populated separately; not committed to git)
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.cron_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON TABLE private.cron_config FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.get_cron_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private
AS $$
  SELECT value FROM private.cron_config WHERE key = 'cron_secret' LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.get_cron_secret() FROM PUBLIC;

DO $$
DECLARE
  job record;
BEGIN
  FOR job IN
    SELECT jobid, jobname FROM cron.job
    WHERE jobname IN (
      'deadline-notifications-hourly',
      'task-due-notifications',
      'invoice-notifications-hourly',
      'movement-notifications-hourly',
      'client-notifications-every-2h',
      'court-sync-every-6h',
      'execute-automations-hourly',
      'court-monitoring-scan-daily'
    )
  LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'deadline-notifications-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vnxuibjgayhmcitpjmde.supabase.co/functions/v1/deadline-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(private.get_cron_secret(), '')
    ),
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
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(private.get_cron_secret(), '')
    ),
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
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(private.get_cron_secret(), '')
    ),
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
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(private.get_cron_secret(), '')
    ),
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
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(private.get_cron_secret(), '')
    ),
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
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(private.get_cron_secret(), '')
    ),
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
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(private.get_cron_secret(), '')
    ),
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
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(private.get_cron_secret(), '')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
