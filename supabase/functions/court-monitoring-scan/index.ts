import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br/api_publica_";

// Map sidebar court names to DataJud tribunal endpoint suffixes
const COURT_TO_TRIBUNAL: Record<string, string[]> = {
  STF: ["stf"],
  STJ: ["stj"],
  TST: ["tst"],
  "TRF-1": ["trf1"], "TRF-2": ["trf2"], "TRF-3": ["trf3"], "TRF-4": ["trf4"], "TRF-5": ["trf5"],
  "TRT-1": ["trt1"], "TRT-2": ["trt2"], "TRT-15": ["trt15"],
  TJSP: ["tjsp"], TJRJ: ["tjrj"], TJMG: ["tjmg"], TJRS: ["tjrs"], TJPR: ["tjpr"],
};

// All tribunal suffixes for broad search
const ALL_TRIBUNALS = [
  "stf", "stj", "tst",
  "trf1", "trf2", "trf3", "trf4", "trf5",
  "tjsp", "tjrj", "tjmg", "tjrs", "tjpr", "tjsc", "tjba", "tjce", "tjpe", "tjgo", "tjdft",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const datajudKey = Deno.env.get("DATAJUD_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    if (!datajudKey) {
      console.error("DATAJUD_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "DATAJUD_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all active monitoring configs
    const { data: configs, error: cfgErr } = await supabase
      .from("court_monitoring_configs")
      .select("*")
      .eq("is_active", true);

    if (cfgErr || !configs?.length) {
      console.log("No active monitoring configs found:", cfgErr?.message);
      return new Response(
        JSON.stringify({ message: "No active configs", configs_processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${configs.length} active monitoring configs`);

    let totalDecisions = 0;
    let totalAlerts = 0;
    let configsProcessed = 0;

    for (const config of configs) {
      try {
        const result = await processConfig(supabase, config, datajudKey);
        totalDecisions += result.decisionsCreated;
        totalAlerts += result.alertsCreated;
        configsProcessed++;

        // Update last_run_at
        await supabase
          .from("court_monitoring_configs")
          .update({ last_run_at: new Date().toISOString() })
          .eq("id", config.id);
      } catch (e) {
        console.error(`Error processing config ${config.id}:`, e);
      }
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      action: "court_monitoring_triggered",
      resource_type: "court_monitoring",
      metadata: {
        configs_processed: configsProcessed,
        decisions_found: totalDecisions,
        alerts_created: totalAlerts,
      },
    } as any);

    return new Response(
      JSON.stringify({
        message: "Monitoring scan completed",
        configs_processed: configsProcessed,
        decisions_found: totalDecisions,
        alerts_created: totalAlerts,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Court monitoring scan error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

interface MonitoringConfig {
  id: string;
  organization_id: string;
  themes: string[];
  keywords: string[];
  legal_areas: string[];
  courts: string[];
  chambers: string[];
  decision_types: string[];
}

async function processConfig(
  supabase: any,
  config: MonitoringConfig,
  datajudKey: string
): Promise<{ decisionsCreated: number; alertsCreated: number }> {
  const keywords = [...(config.keywords || []), ...(config.themes || [])];
  if (keywords.length === 0) {
    console.log(`Config ${config.id}: no keywords/themes, skipping`);
    return { decisionsCreated: 0, alertsCreated: 0 };
  }

  // Resolve which tribunals to query
  const tribunals = resolveTribunals(config.courts || []);
  console.log(`Config ${config.id}: querying ${tribunals.length} tribunals for ${keywords.length} keywords`);

  let decisionsCreated = 0;
  let alertsCreated = 0;

  for (const tribunal of tribunals) {
    for (const keyword of keywords.slice(0, 5)) { // Limit to 5 keywords per tribunal to avoid rate limits
      try {
        const decisions = await searchDataJud(datajudKey, tribunal, keyword);
        
        for (const decision of decisions) {
          // Check for duplicates by decision_number + tribunal
          if (decision.decisionNumber) {
            const { data: existing } = await supabase
              .from("court_monitoring_decisions")
              .select("id")
              .eq("organization_id", config.organization_id)
              .eq("tribunal", decision.tribunal)
              .eq("decision_number", decision.decisionNumber)
              .maybeSingle();

            if (existing) continue;
          }

          // Calculate relevance based on keyword matches
          const matchedThemes = (config.themes || []).filter((t) =>
            decision.summary?.toLowerCase().includes(t.toLowerCase()) ||
            decision.thesis?.toLowerCase().includes(t.toLowerCase())
          );
          const matchedKeywords = (config.keywords || []).filter((k) =>
            decision.summary?.toLowerCase().includes(k.toLowerCase()) ||
            decision.thesis?.toLowerCase().includes(k.toLowerCase())
          );

          const totalMatches = matchedThemes.length + matchedKeywords.length;
          const relevance = totalMatches >= 3 ? "high" : totalMatches >= 1 ? "medium" : "low";

          // Determine impact based on tribunal level
          const upperTribunals = ["stf", "stj", "tst"];
          const impactLevel = upperTribunals.includes(tribunal) ? "high" : "medium";

          const { error: insertErr } = await supabase.from("court_monitoring_decisions").insert({
            organization_id: config.organization_id,
            config_id: config.id,
            tribunal: decision.tribunal,
            chamber: decision.chamber || null,
            decision_date: decision.date || null,
            decision_number: decision.decisionNumber || null,
            summary: decision.summary || null,
            thesis: decision.thesis || null,
            relevance_level: relevance,
            impact_level: impactLevel,
            matched_themes: matchedThemes,
            matched_keywords: matchedKeywords,
            ai_recommendation: generateRecommendation(relevance, impactLevel, matchedThemes),
            alert_sent: false,
            status: "new",
            metadata: { source_tribunal: tribunal, search_keyword: keyword },
          } as any);

          if (!insertErr) {
            decisionsCreated++;

            // Create alert for high-relevance decisions
            if (relevance === "high") {
              alertsCreated++;

              await supabase.from("audit_logs").insert({
                action: "court_monitoring_decision_detected",
                organization_id: config.organization_id,
                resource_type: "court_monitoring_decision",
                metadata: {
                  tribunal: decision.tribunal,
                  decision_number: decision.decisionNumber,
                  relevance_level: relevance,
                  matched_themes: matchedThemes,
                  matched_keywords: matchedKeywords,
                },
              } as any);

              await supabase.from("audit_logs").insert({
                action: "jurisprudence_alert_generated",
                organization_id: config.organization_id,
                resource_type: "jurisprudence_alert",
                metadata: {
                  config_id: config.id,
                  tribunal: decision.tribunal,
                  relevance: relevance,
                  themes: matchedThemes,
                },
              } as any);

              // Send email notification to org members
              await sendAlertEmail(
                supabase,
                config.organization_id,
                decision,
                matchedThemes,
                matchedKeywords,
                generateRecommendation(relevance, impactLevel, matchedThemes)
              );
            }
          }
        }
      } catch (err) {
        console.error(`Error searching ${tribunal} for "${keyword}":`, err);
      }
    }
  }

  return { decisionsCreated, alertsCreated };
}

/**
 * Search DataJud for decisions matching a keyword.
 */
async function searchDataJud(
  apiKey: string,
  tribunal: string,
  keyword: string
): Promise<Array<{
  tribunal: string;
  chamber: string | null;
  date: string | null;
  decisionNumber: string | null;
  summary: string | null;
  thesis: string | null;
}>> {
  const url = `${DATAJUD_BASE}${tribunal}/_search`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          bool: {
            should: [
              { match: { "movimentos.nome": { query: keyword, operator: "and" } } },
              { match: { "assuntos.nome": { query: keyword, operator: "and" } } },
              { match_phrase: { "movimentos.complementosTabelados.descricao": keyword } },
            ],
            minimum_should_match: 1,
          },
        },
        sort: [{ "dataAjuizamento": { order: "desc" } }],
        size: 10,
        _source: [
          "numeroProcesso", "classe.nome", "assuntos", "movimentos",
          "dataAjuizamento", "orgaoJulgador", "tribunal",
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(`DataJud ${tribunal} returned ${response.status}: ${text.substring(0, 200)}`);
      return [];
    }

    const data = await response.json();
    const hits = data?.hits?.hits || [];

    return hits.map((hit: any) => {
      const src = hit._source;
      const lastMovement = (src.movimentos || [])[0];
      const subjects = (src.assuntos || []).map((a: any) => a.nome).filter(Boolean);

      return {
        tribunal: tribunal.toUpperCase(),
        chamber: src.orgaoJulgador?.nome || null,
        date: src.dataAjuizamento || lastMovement?.dataHora || null,
        decisionNumber: src.numeroProcesso || null,
        summary: subjects.length > 0
          ? `${src.classe?.nome || "Processo"} — ${subjects.join(", ")}`
          : lastMovement?.nome || src.classe?.nome || null,
        thesis: lastMovement?.complementosTabelados
          ?.map((c: any) => c.descricao || c.nome)
          .filter(Boolean)
          .join("; ") || null,
      };
    });
  } catch (err) {
    console.error(`Error fetching DataJud ${tribunal}:`, err);
    return [];
  }
}

function resolveTribunals(courts: string[]): string[] {
  if (!courts || courts.length === 0) return ALL_TRIBUNALS.slice(0, 5);

  const tribunals: string[] = [];
  for (const court of courts) {
    const mapped = COURT_TO_TRIBUNAL[court];
    if (mapped) {
      tribunals.push(...mapped);
    } else {
      // Try lowercase match
      const normalized = court.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (ALL_TRIBUNALS.includes(normalized)) {
        tribunals.push(normalized);
      }
    }
  }

  return [...new Set(tribunals.length > 0 ? tribunals : ALL_TRIBUNALS.slice(0, 5))];
}

function generateRecommendation(
  relevance: string,
  impact: string,
  matchedThemes: string[]
): string {
  if (relevance === "high" && impact === "high") {
    return `⚠️ Decisão de alta relevância em tribunal superior. Temas: ${matchedThemes.join(", ")}. Recomenda-se análise imediata e verificação de impacto em processos ativos.`;
  }
  if (relevance === "high") {
    return `Decisão relevante identificada nos temas: ${matchedThemes.join(", ")}. Verificar se há processos ativos que podem ser impactados.`;
  }
  if (impact === "high") {
    return `Decisão de tribunal superior detectada. Analisar potencial impacto jurisprudencial e precedente vinculante.`;
  }
  return `Decisão monitorada com relevância ${relevance === "medium" ? "média" : "baixa"}. Acompanhar evolução.`;
}

/**
 * Send email alert to org members with notifications enabled via Resend.
 */
async function sendAlertEmail(
  supabase: any,
  organizationId: string,
  decision: { tribunal: string; decisionNumber: string | null; summary: string | null; date: string | null },
  matchedThemes: string[],
  matchedKeywords: string[],
  recommendation: string
) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.warn("RESEND_API_KEY not configured — skipping email alert");
    return;
  }

  const { data: org } = await supabase
    .from("organizations").select("name").eq("id", organizationId).single();
  const orgName = org?.name || "Escritório";

  const { data: members } = await supabase
    .from("user_organizations").select("user_id")
    .eq("organization_id", organizationId).eq("status", "active");
  if (!members?.length) return;

  const userIds = members.map((m: any) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles").select("user_id")
    .in("user_id", userIds).eq("notify_deadlines", true).eq("notify_email", true);
  if (!profiles?.length) return;

  const { data: appUsers } = await supabase
    .from("app_users").select("auth_user_id, email")
    .in("auth_user_id", profiles.map((p: any) => p.user_id));
  if (!appUsers?.length) return;

  const recipients = appUsers.map((u: any) => u.email).filter(Boolean);
  if (!recipients.length) return;

  const decisionDate = decision.date
    ? new Date(decision.date).toLocaleDateString("pt-BR") : "Não informada";

  const htmlContent = `
    <div style="font-family:'Segoe UI',Tahoma,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:24px;border-radius:12px 12px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:20px;">⚖️ Alerta Jurisprudencial — ${orgName}</h1>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #eee;border-radius:0 0 12px 12px;">
        <p style="color:#333;">Uma decisão de <strong>alta relevância</strong> foi detectada pelo monitoramento automático.</p>
        <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#666;font-size:13px;">Tribunal</td><td style="padding:8px 0;text-align:right;font-weight:600;">${decision.tribunal}</td></tr>
            <tr><td style="padding:8px 0;color:#666;font-size:13px;">Número</td><td style="padding:8px 0;text-align:right;font-weight:600;">${decision.decisionNumber || "—"}</td></tr>
            <tr><td style="padding:8px 0;color:#666;font-size:13px;">Data</td><td style="padding:8px 0;text-align:right;font-weight:600;">${decisionDate}</td></tr>
            <tr><td style="padding:8px 0;color:#666;font-size:13px;">Resumo</td><td style="padding:8px 0;text-align:right;font-weight:600;">${decision.summary || "—"}</td></tr>
            <tr><td style="padding:8px 0;color:#666;font-size:13px;">Temas</td><td style="padding:8px 0;text-align:right;">${matchedThemes.map(t => `<span style="background:#ede9fe;color:#6d28d9;padding:2px 8px;border-radius:9999px;font-size:12px;margin-left:4px;">${t}</span>`).join(" ")}</td></tr>
            <tr><td style="padding:8px 0;color:#666;font-size:13px;">Palavras-chave</td><td style="padding:8px 0;text-align:right;">${matchedKeywords.map(k => `<span style="background:#e0e7ff;color:#3730a3;padding:2px 8px;border-radius:9999px;font-size:12px;margin-left:4px;">${k}</span>`).join(" ")}</td></tr>
          </table>
        </div>
        <div style="background:#fefce8;border-left:4px solid #eab308;padding:12px 16px;border-radius:4px;margin:16px 0;">
          <p style="color:#713f12;margin:0;font-size:14px;"><strong>Recomendação:</strong> ${recommendation}</p>
        </div>
        <p style="color:#555;font-size:14px;">Acesse o <strong>Monitoramento de Tribunais</strong> na plataforma para detalhes completos.</p>
        <p style="color:#888;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:16px;">Email automático enviado por ${orgName} via Lexia.</p>
      </div>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${orgName} <onboarding@resend.dev>`,
        to: recipients,
        subject: `⚖️ Alerta: Decisão relevante no ${decision.tribunal} — ${matchedThemes.slice(0, 2).join(", ")}`,
        html: htmlContent,
      }),
    });
    if (!res.ok) {
      console.error(`Resend error [${res.status}]: ${await res.text()}`);
    } else {
      console.log(`Alert email sent to ${recipients.length} recipients for ${decision.tribunal}`);
    }
  } catch (err) {
    console.error("Failed to send alert email:", err);
  }
}
