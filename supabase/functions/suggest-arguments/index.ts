import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth, requireOrgMember } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPTS: Record<string, string> = {
  argument: `Você é um assistente jurídico especializado em argumentação. Com base no contexto do processo, documentos, movimentações e jurisprudência fornecidos, sugira argumentos jurídicos sólidos e fundamentados.
Considere: argumentos de mérito, preliminares, processuais, defensivos, probatórios, baseados em documentos, jurisprudência e precedentes vinculantes.
Cada argumento deve ter fundamentação jurídica real, fundamentação fática, indicação de risco jurídico e trecho sugerido para inserção na peça.
NUNCA invente fatos, documentos ou jurisprudência. Indique quando um argumento é fraco ou arriscado.`,

  counter_argument: `Você é um assistente jurídico especializado em análise de risco. Gere argumentos que a PARTE ADVERSA poderia usar contra o cliente.
Para cada contra-argumento, inclua: descrição, fundamentação jurídica, jurisprudência que o sustenta, probabilidade de uso, impacto potencial e sugestões de contra-argumentação.
NÃO invente fatos. Indique quando o risco é especulativo. Estes argumentos são apenas para análise interna, não para inserção na peça.`,

  request: `Você é um assistente jurídico especializado em formulação de pedidos. Sugira pedidos jurídicos adequados ao tipo de ação, fatos, provas e jurisprudência.
Inclua: pedidos principais, subsidiários, alternativos, tutela de urgência, produção de provas, honorários. Cada pedido deve ter texto sugerido, fundamentação legal e jurisprudencial, relação com fatos e riscos.
NÃO sugira pedidos incompatíveis com o tipo de ação. Alerte quando um pedido é arriscado.`,

  legal_basis: `Você é um assistente jurídico especializado em fundamentação. Sugira fundamentos jurídicos específicos conforme a área do direito do processo.
Inclua: fundamentos legais (artigos), jurisprudenciais, doutrinários, principiológicos, probatórios e contratuais.
NÃO cite artigos revogados. Evite fundamentos contraditórios. Alerte quando um fundamento é frágil.`,

  evidence: `Você é um assistente jurídico especializado em provas. Sugira provas relevantes com base nos fatos, documentos anexados, jurisprudência e ônus da prova.
Inclua: documentos contratuais, comprovantes, laudos, perícias, testemunhas, provas digitais. Para cada prova, indique justificativa jurídica, relação com fatos e pedidos, risco de ausência.
NÃO invente provas inexistentes. Sugira alternativas quando possível.`,
};

const AUDIT_ACTIONS: Record<string, string> = {
  argument: "argument_suggestion_generated",
  counter_argument: "counter_argument_generated",
  request: "request_suggestion_generated",
  legal_basis: "legal_basis_suggestion_generated",
  evidence: "evidence_suggestion_generated",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;

    const { organization_id, process_id, draft_id, suggestion_type, piece_type, context } = await req.json();

    if (!organization_id || !suggestion_type) {
      return new Response(JSON.stringify({ error: "organization_id and suggestion_type required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const memberError = await requireOrgMember(auth.supabase, auth.userId, organization_id);
    if (memberError) return memberError;

    const supabase = auth.supabase;

    // Aggregate context
    let processContext = "";
    if (process_id) {
      const { data: proc } = await supabase.from("processes").select("*").eq("id", process_id).maybeSingle();
      if (proc) {
        processContext += `\n## Processo\nTítulo: ${proc.title}\nNúmero: ${proc.number || "N/A"}\nClasse: ${proc.process_class || "N/A"}\nAssunto: ${proc.subject || "N/A"}\nVara/Tribunal: ${proc.court || "N/A"}\nFase: ${proc.phase || "N/A"}\nDescrição: ${proc.description || "N/A"}\n`;

        if (proc.client_id) {
          const { data: client } = await supabase.from("clients").select("full_name, client_type, business_area").eq("id", proc.client_id).maybeSingle();
          if (client) {
            processContext += `\n## Cliente\nNome: ${client.full_name}\nTipo: ${client.client_type}\nÁrea: ${client.business_area || "N/A"}\n`;
          }
        }

        const { data: docs } = await supabase.from("documents").select("file_name, category, description").eq("process_id", process_id).limit(20);
        if (docs?.length) {
          processContext += `\n## Documentos anexados\n${docs.map((d) => `- ${d.file_name} (${d.category || "sem categoria"})${d.description ? ": " + d.description : ""}`).join("\n")}\n`;
        }

        const { data: events } = await supabase.from("process_events").select("title, description, event_date").eq("process_id", process_id).order("event_date", { ascending: false }).limit(15);
        if (events?.length) {
          processContext += `\n## Movimentações recentes\n${events.map((e) => `- ${e.event_date || ""}: ${e.title}${e.description ? " — " + e.description : ""}`).join("\n")}\n`;
        }

        const { data: refs } = await supabase.from("legal_references").select("title, source, content").eq("organization_id", organization_id).limit(10);
        if (refs?.length) {
          processContext += `\n## Referências jurídicas da organização\n${refs.map((r) => `- ${r.title} (${r.source || ""}): ${(r.content || "").slice(0, 200)}`).join("\n")}\n`;
        }
      }
    }

    // Get draft content if available
    let draftContext = "";
    if (draft_id) {
      const { data: draft } = await supabase.from("drafts").select("title, piece_type, content, instructions").eq("id", draft_id).maybeSingle();
      if (draft) {
        draftContext = `\n## Minuta atual\nTítulo: ${draft.title}\nTipo: ${draft.piece_type}\nInstruções: ${draft.instructions || "N/A"}\nConteúdo (primeiros 2000 chars):\n${(draft.content || "").slice(0, 2000)}\n`;
      }
    }

    const systemPrompt = SYSTEM_PROMPTS[suggestion_type] || SYSTEM_PROMPTS.argument;
    const userPrompt = `${processContext}${draftContext}${context ? `\n## Contexto adicional\n${context}` : ""}${piece_type ? `\n## Tipo de peça: ${piece_type}` : ""}\n\nGere sugestões de ${suggestion_type === "counter_argument" ? "contra-argumentos" : suggestion_type === "request" ? "pedidos" : suggestion_type === "legal_basis" ? "fundamentos jurídicos" : suggestion_type === "evidence" ? "provas" : "argumentos"} para este caso.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_suggestions",
              description: "Return structured legal suggestions",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Título do argumento/pedido/fundamento/prova" },
                        content: { type: "string", description: "Texto completo da sugestão, incluindo fundamentação e trecho para inserção" },
                        legal_basis: { type: "string", description: "Base legal (artigos, leis)" },
                        jurisprudence: { type: "string", description: "Jurisprudência aplicável" },
                        risk_level: { type: "string", enum: ["low", "medium", "high"], description: "Nível de risco jurídico" },
                        strength_score: { type: "integer", description: "Pontuação de força jurídica de 0 a 100" },
                        category: { type: "string", description: "Categoria: merito, preliminar, processual, defensivo, probatorio, estrategia" },
                      },
                      required: ["title", "content", "risk_level", "strength_score", "category"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_suggestions" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos no workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResp.text();
      console.error("AI error:", aiResp.status, errText);
      return new Response(JSON.stringify({ error: "Erro na IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    let suggestions: any[] = [];

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        suggestions = parsed.suggestions || [];
      } catch {
        console.error("Failed to parse tool call arguments");
      }
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      action: AUDIT_ACTIONS[suggestion_type] || "argument_suggestion_generated",
      user_id: null,
      organization_id,
      resource_type: "argument_suggestion",
      resource_id: draft_id || process_id || null,
      metadata: { suggestion_type, count: suggestions.length, process_id, draft_id },
    });

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-arguments error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
