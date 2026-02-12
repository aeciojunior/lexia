-- Schedule execute-automations to run every hour
SELECT cron.schedule(
  'execute-automations-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://dnpakncqtzjdtkwcjpsw.supabase.co/functions/v1/execute-automations',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRucGFrbmNxdHpqZHRrd2NqcHN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTYzMjcsImV4cCI6MjA4NjQ3MjMyN30.BYLKOhlr-ekFWDQStd5ieSlUuhgypxRvgpO6L7gLc6U"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);
