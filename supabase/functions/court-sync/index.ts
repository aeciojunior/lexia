import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// DataJud API base URLs per court system / tribunal
const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br/api_publica_";

// Mapping of court_system to DataJud tribunal endpoint suffixes
const TRIBUNAL_MAP: Record<string, string[]> = {
  pje: [
    "trf1", "trf2", "trf3", "trf4", "trf5", "trf6",
    "tst", "tse", "stj", "stf",
    "tjac", "tjal", "tjam", "tjap", "tjba", "tjce", "tjdft", "tjes",
    "tjgo", "tjma", "tjmg", "tjms", "tjmt", "tjpa", "tjpb", "tjpe",
    "tjpi", "tjpr", "tjrj", "tjrn", "tjro", "tjrr", "tjrs", "tjsc",
    "tjse", "tjsp", "tjto",
  ],
  esaj: ["tjsp", "tjms", "tjsc", "tjce", "tjam"],
  projudi: ["tjpr", "tjgo", "tjmt", "tjrn", "tjpi", "tjal", "tjpb"],
  eproc: ["trf4", "tjsc", "tjto", "tjrr"],
  tucujuris: ["tjap"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const datajudKey = Deno.env.get("DATAJUD_API_KEY");

    const body = await req.json().catch(() => ({}));
    const { integration_id, sync_all, process_id } = body;

    // If process_id is provided, find or create integration then sync
    if (process_id && !integration_id && !sync_all) {
      const { data: existingInteg } = await supabase
        .from("court_integrations")
        .select("id")
        .eq("process_id", process_id)
        .eq("status", "active")
        .maybeSingle();

      if (existingInteg) {
        const result = await syncIntegration(supabase, existingInteg.id, datajudKey, body);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // No integration exists — try to auto-create from process data
      const { data: proc } = await supabase
        .from("processes")
        .select("id, number, organization_id, user_id, court")
        .eq("id", process_id)
        .single();

      if (!proc?.number) {
        return new Response(
          JSON.stringify({ error: "Processo não encontrado ou sem número." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Detect court system from number
      const courtSystem = detectCourtSystem(proc.number);

      const { data: newInteg, error: createErr } = await supabase
        .from("court_integrations")
        .insert({
          organization_id: proc.organization_id,
          process_id: proc.id,
          court_system: courtSystem,
          court_process_id: proc.number,
          status: "active",
        })
        .select("id")
        .single();

      if (createErr) {
        return new Response(
          JSON.stringify({ error: "Erro ao criar integração: " + createErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await syncIntegration(supabase, newInteg.id, datajudKey, body);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If sync_all is true, process all active integrations (called by pg_cron)
    if (sync_all) {
      console.log("Starting batch sync for all active integrations...");
      const { data: integrations, error } = await supabase
        .from("court_integrations")
        .select("id")
        .eq("status", "active");

      if (error || !integrations?.length) {
        console.log("No active integrations found or error:", error?.message);
        return new Response(
          JSON.stringify({ message: "No active integrations", count: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let totalCreated = 0;
      let synced = 0;
      let errors = 0;

      for (const integ of integrations) {
        try {
          const result = await syncIntegration(supabase, integ.id, datajudKey, { source: "cron" });
          totalCreated += result.movements_created;
          synced++;
        } catch (e) {
          console.error(`Error syncing integration ${integ.id}:`, e);
          errors++;
        }
      }

      return new Response(
        JSON.stringify({
          message: "Batch sync completed",
          integrations_synced: synced,
          integrations_errored: errors,
          total_movements_created: totalCreated,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Single integration sync
    if (!integration_id) {
      return new Response(
        JSON.stringify({ error: "integration_id, process_id or sync_all required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await syncIntegration(supabase, integration_id, datajudKey, body);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Court sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Detect court system based on CNJ process number.
 */
function detectCourtSystem(processNumber: string): string {
  const digits = processNumber.replace(/\D/g, "");
  if (digits.length < 20) return "pje";
  // CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
  // J = justice segment (position 13, 0-indexed)
  // TR = tribunal code (positions 14-15)
  const justiceSegment = digits[13];
  // 5 = Trabalho (TRT), 4 = Militar, 3 = Eleitoral, 2 = Federal (TRF), 1 = STF, 6 = STJ, 8 = Estadual
  // For most state courts, check if eproc/esaj/projudi based on the TR code
  const trCode = digits.substring(14, 16);

  // TRF4 uses eproc
  if (justiceSegment === "4" || (justiceSegment === "5" && ["04"].includes(trCode))) return "eproc";
  // TJSP mainly uses esaj
  if (justiceSegment === "8" && trCode === "26") return "esaj";
  // TJPR uses projudi
  if (justiceSegment === "8" && trCode === "16") return "projudi";
  // Default to PJe
  return "pje";
}

async function syncIntegration(
  supabase: any,
  integrationId: string,
  datajudKey: string | undefined,
  reqBody?: any
) {
  const { data: integ, error: integErr } = await supabase
    .from("court_integrations")
    .select("*, processes(number, title, organization_id, user_id, court)")
    .eq("id", integrationId)
    .single();

  if (integErr || !integ) {
    throw new Error("Integration not found");
  }

  const process = integ.processes as any;
  const processNumber = (integ.court_process_id || process?.number || "").replace(/\D/g, "");

  if (!processNumber) {
    throw new Error("No process number available for sync");
  }

  console.log(`Syncing ${integ.court_system} for process ${processNumber}`);

  let movements: Array<{ title: string; description?: string; type: string; date: string }> = [];

  // Try DataJud API first (real integration)
  if (datajudKey) {
    movements = await queryDataJud(datajudKey, integ.court_system, processNumber, process?.court);
  } else {
    console.warn("DATAJUD_API_KEY not set, skipping real API query");
  }

  let movementsCreated = 0;

  if (movements.length > 0) {
    // Get existing movements to avoid duplicates
    const { data: existingMovements } = await supabase
      .from("process_movements")
      .select("title, movement_date")
      .eq("process_id", integ.process_id)
      .eq("origin", integ.court_system);

    const existingSet = new Set(
      (existingMovements || []).map((m: any) => `${m.title}|${m.movement_date}`)
    );

    for (const mv of movements) {
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

  // Update last_sync_at
  await supabase.from("court_integrations").update({
    last_sync_at: new Date().toISOString(),
    status: "active",
    sync_config: {
      ...(integ.sync_config || {}),
      last_movements_found: movements.length,
      last_movements_created: movementsCreated,
      last_sync_source: datajudKey ? "datajud" : "none",
    },
  }).eq("id", integrationId);

  // Write import log
  const logStatus = movements.length === 0 ? "sem_novidades" : (movementsCreated > 0 ? "sucesso" : "sem_novidades");
  const logMessage = movements.length === 0
    ? "Nenhuma movimentação nova encontrada."
    : `${movementsCreated} movimentação(ões) importada(s) de ${movements.length} encontrada(s).`;

  await supabase.from("import_logs").insert({
    process_id: integ.process_id,
    organization_id: integ.organization_id,
    court_system: integ.court_system,
    tribunal: process?.court || null,
    status: logStatus,
    message: logMessage,
    movements_found: movements.length,
    movements_created: movementsCreated,
    source: reqBody?.source || "manual",
  });

  return {
    message: "Sync completed",
    movements_found: movements.length,
    movements_created: movementsCreated,
    court_system: integ.court_system,
    source: datajudKey ? "datajud_api" : "no_api_key",
  };
}

/**
 * Query the CNJ DataJud API for process movements.
 * The DataJud API uses Elasticsearch-style queries.
 * Docs: https://datajud-wiki.cnj.jus.br/api-publica/acesso
 */
async function queryDataJud(
  apiKey: string,
  courtSystem: string,
  processNumber: string,
  courtHint?: string
): Promise<Array<{ title: string; description?: string; type: string; date: string }>> {
  // Determine which tribunal endpoints to try
  const tribunalSuffixes = resolveTribunals(courtSystem, courtHint);

  for (const tribunal of tribunalSuffixes) {
    try {
      const url = `${DATAJUD_BASE}${tribunal}/_search`;

      console.log(`Querying DataJud: ${url} for process ${processNumber}`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: {
            match: {
              numeroProcesso: processNumber,
            },
          },
          size: 1,
        }),
      });

      if (!response.ok) {
        console.warn(`DataJud ${tribunal} returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      const hits = data?.hits?.hits || [];

      if (hits.length === 0) {
        console.log(`No results from ${tribunal}`);
        continue;
      }

      const processData = hits[0]._source;
      const rawMovements = processData?.movimentos || processData?.movimento || [];

      console.log(`Found ${rawMovements.length} movements from ${tribunal}`);

      return rawMovements.map((mv: any) => {
        const movName = mv.nome || mv.complementosTabelados?.map((c: any) => c.nome || c.descricao).filter(Boolean).join(" - ") || "Movimentação";
        const movDate = mv.dataHora || mv.data || new Date().toISOString();
        const movType = mapMovementType(mv.codigo || 0, movName);

        return {
          title: movName.substring(0, 500),
          description: mv.complemento || mv.descricao || buildComplementDescription(mv),
          type: movType,
          date: movDate,
        };
      });
    } catch (err) {
      console.error(`Error querying DataJud ${tribunal}:`, err);
      continue;
    }
  }

  console.log("No results from any tribunal endpoint");
  return [];
}

/**
 * Resolve which tribunal endpoint(s) to query based on court system and court hint.
 */
function resolveTribunals(courtSystem: string, courtHint?: string): string[] {
  // If we have a court hint, try to extract tribunal abbreviation
  if (courtHint) {
    const normalized = courtHint.toLowerCase().replace(/[^a-z0-9]/g, "");
    // Match common patterns like "TJSP", "TRF1", "TST", etc.
    const match = normalized.match(/(tj[a-z]{2}|trf\d|tst|tse|stj|stf)/);
    if (match) {
      return [match[1]];
    }
  }

  // Fall back to tribunal map for the court system
  const tribunals = TRIBUNAL_MAP[courtSystem] || TRIBUNAL_MAP["pje"];

  // Try to infer tribunal from process number (UF digits 18-19 in CNJ format)
  // CNJ format: NNNNNNN-DD.AAAA.J.TR.OOOO
  // We can check the J (justice segment) and TR (tribunal/UF)
  // For now, return a subset of most common tribunals
  return tribunals.slice(0, 5);
}

/**
 * Map CNJ movement code / name to our movement_type enum.
 */
function mapMovementType(code: number, name: string): string {
  const n = name.toLowerCase();
  if (n.includes("sentença") || n.includes("sentenca")) return "sentença";
  if (n.includes("despacho")) return "despacho";
  if (n.includes("decisão") || n.includes("decisao")) return "decisão";
  if (n.includes("citação") || n.includes("citacao")) return "citação";
  if (n.includes("intimação") || n.includes("intimacao")) return "intimação";
  if (n.includes("audiência") || n.includes("audiencia")) return "audiência";
  if (n.includes("recurso") || n.includes("apelação") || n.includes("agravo")) return "recurso";
  if (n.includes("petição") || n.includes("peticao")) return "petição";
  if (n.includes("julgamento")) return "julgamento";
  if (n.includes("distribuição") || n.includes("distribuicao")) return "distribuição";
  if (n.includes("arquiv")) return "arquivamento";
  if (n.includes("trânsito") || n.includes("transito")) return "trânsito em julgado";
  return "despacho";
}

/**
 * Build a complement description from movement data.
 */
function buildComplementDescription(mv: any): string | undefined {
  const parts: string[] = [];
  if (mv.complementosTabelados?.length) {
    for (const c of mv.complementosTabelados) {
      if (c.descricao) parts.push(c.descricao);
      else if (c.nome) parts.push(c.nome);
    }
  }
  if (mv.orgaoJulgador?.nome) {
    parts.push(`Órgão: ${mv.orgaoJulgador.nome}`);
  }
  return parts.length > 0 ? parts.join(" | ") : undefined;
}
