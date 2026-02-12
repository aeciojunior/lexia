
-- Schedule hourly deadline notification check
SELECT cron.schedule(
  'deadline-notifications-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://dnpakncqtzjdtkwcjpsw.supabase.co/functions/v1/deadline-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRucGFrbmNxdHpqZHRrd2NqcHN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTYzMjcsImV4cCI6MjA4NjQ3MjMyN30.BYLKOhlr-ekFWDQStd5ieSlUuhgypxRvgpO6L7gLc6U"}'::jsonb,
        body:='{}'::jsonb
    ) AS request_id;
  $$
);
