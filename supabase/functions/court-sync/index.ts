import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { integration_id } = await req.json();
    if (!integration_id) {
      return new Response(JSON.stringify({ error: "integration_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch integration details
    const { data: integ, error: integErr } = await supabase
      .from("court_integrations")
      .select("*, processes(number, title, organization_id, user_id)")
      .eq("id", integration_id)
      .single();

    if (integErr || !integ) {
      return new Response(JSON.stringify({ error: "Integration not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const process = integ.processes as any;
    const processNumber = integ.court_process_id || process?.number?.replace(/\D/g, "") || "";

    // Simulate PJe/court system API call
    // In production, this would call the actual court API (PJe, e-SAJ, etc.)
    // For now, we simulate checking for new movements
    console.log(`Syncing ${integ.court_system} for process ${processNumber}`);

    // Simulated response - in production replace with actual API call
    // Example PJe API: https://pje.trf1.jus.br/consultapublica/api/processos/{numero}
    const simulatedMovements = await simulateCourtQuery(integ.court_system, processNumber);

    let movementsCreated = 0;

    if (simulatedMovements.length > 0) {
      // Get existing movements to avoid duplicates
      const { data: existingMovements } = await supabase
        .from("process_movements")
        .select("title, movement_date")
        .eq("process_id", integ.process_id)
        .eq("origin", integ.court_system);

      const existingSet = new Set(
        (existingMovements || []).map((m: any) => `${m.title}|${m.movement_date}`)
      );

      for (const mv of simulatedMovements) {
        const key = `${mv.title}|${mv.date}`;
        if (existingSet.has(key)) continue;

        const { error: insertErr } = await supabase.from("process_movements").insert({
          process_id: integ.process_id,
          organization_id: integ.organization_id,
          user_id: process.user_id,
          title: mv.title,
          description: mv.description || null,
          movement_type: mv.type || "despacho",
          movement_date: mv.date,
          origin: integ.court_system,
        });

        if (!insertErr) movementsCreated++;
      }
    }

    // Update last_sync_at and status
    await supabase.from("court_integrations").update({
      last_sync_at: new Date().toISOString(),
      status: "active",
    }).eq("id", integration_id);

    return new Response(
      JSON.stringify({
        message: "Sync completed",
        movements_found: simulatedMovements.length,
        movements_created: movementsCreated,
        court_system: integ.court_system,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Court sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Simulated court query - replace with real API integration in production
async function simulateCourtQuery(courtSystem: string, processNumber: string) {
  // In a real implementation, this would:
  // PJe: Call PJe SOAP/REST API
  // e-SAJ: Scrape or call e-SAJ API
  // PROJUDI: Call PROJUDI API
  // e-Proc: Call e-Proc API

  // For demonstration, return empty array (no new movements)
  // When connected to a real court API, parse the response into this format:
  // [{ title: "Despacho", description: "...", type: "despacho", date: "2025-01-15T10:00:00Z" }]

  console.log(`[${courtSystem}] Querying for process ${processNumber}`);

  // Return empty for now - ready for real API integration
  return [] as Array<{ title: string; description?: string; type: string; date: string }>;
}
