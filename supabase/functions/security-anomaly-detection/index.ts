import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { organizationId } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get recent security events
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentEvents } = await supabase
      .from("security_events")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("created_at", oneHourAgo);

    const anomalies: any[] = [];

    // Detect: too many failed access attempts from same user
    const failedByUser: Record<string, number> = {};
    (recentEvents || []).forEach((e: any) => {
      if (e.event_type.includes("denied") || e.event_type.includes("violation")) {
        failedByUser[e.user_id] = (failedByUser[e.user_id] || 0) + 1;
      }
    });

    for (const [userId, count] of Object.entries(failedByUser)) {
      if (count >= 5) {
        anomalies.push({
          organization_id: organizationId,
          event_type: "brute_force_suspected",
          severity: "critical",
          source: "anomaly_detection",
          user_id: userId,
          description: `Usuário com ${count} tentativas negadas na última hora`,
          is_anomaly: true,
        });
      }
    }

    // Detect: access from unusual IPs (multiple IPs for same user)
    const ipsByUser: Record<string, Set<string>> = {};
    (recentEvents || []).forEach((e: any) => {
      if (e.user_id && e.ip_address) {
        if (!ipsByUser[e.user_id]) ipsByUser[e.user_id] = new Set();
        ipsByUser[e.user_id].add(e.ip_address);
      }
    });

    for (const [userId, ips] of Object.entries(ipsByUser)) {
      if (ips.size >= 4) {
        anomalies.push({
          organization_id: organizationId,
          event_type: "multiple_ip_access",
          severity: "warning",
          source: "anomaly_detection",
          user_id: userId,
          description: `Usuário acessando de ${ips.size} IPs diferentes na última hora`,
          is_anomaly: true,
        });
      }
    }

    // Insert anomalies
    if (anomalies.length > 0) {
      await supabase.from("security_events").insert(anomalies);

      // Create alerts for critical anomalies
      const criticalAlerts = anomalies
        .filter(a => a.severity === "critical")
        .map(a => ({
          organization_id: organizationId,
          alert_type: a.event_type,
          severity: a.severity,
          title: `Anomalia: ${a.event_type}`,
          description: a.description,
        }));

      if (criticalAlerts.length > 0) {
        await supabase.from("security_alerts").insert(criticalAlerts);
      }
    }

    return new Response(JSON.stringify({ anomalies_detected: anomalies.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in anomaly detection:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
