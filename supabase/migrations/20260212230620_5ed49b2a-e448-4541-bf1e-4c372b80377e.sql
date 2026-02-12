-- Schedule court-sync to run every 6 hours for all active integrations
SELECT cron.schedule(
  'court-sync-every-6h',
  '0 */6 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://dnpakncqtzjdtkwcjpsw.supabase.co/functions/v1/court-sync',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRucGFrbmNxdHpqZHRrd2NqcHN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTYzMjcsImV4cCI6MjA4NjQ3MjMyN30.BYLKOhlr-ekFWDQStd5ieSlUuhgypxRvgpO6L7gLc6U"}'::jsonb,
      body := '{"sync_all": true}'::jsonb
    ) AS request_id;
  $$
);
