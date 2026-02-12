-- Schedule client-notifications to run every 2 hours
SELECT cron.schedule(
  'client-notifications-every-2h',
  '30 */2 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://dnpakncqtzjdtkwcjpsw.supabase.co/functions/v1/client-notifications',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRucGFrbmNxdHpqZHRrd2NqcHN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTYzMjcsImV4cCI6MjA4NjQ3MjMyN30.BYLKOhlr-ekFWDQStd5ieSlUuhgypxRvgpO6L7gLc6U"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
