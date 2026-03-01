import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODE_PROMPTS: Record<string, string> = {
  automatico: `Você é um revisor jurídico completo. Revise o texto nas quatro camadas: linguística (gramática, ortografia, concordância, regência, pontuação), clareza (simplificação, ambiguidades, fluidez), coesão e estrutura (conectores, ordem lógica, padronização), e técnica jurídica (terminologia, adequação à peça, citações legais, inconsistências).`,
  assistido: `Você é um revisor jurídico assistido. Sugira correções detalhadas com explicação pedagógica para cada item. O usuário decidirá quais aplicar. Foque em todas as camadas: linguística, clareza, coesão e técnica.`,
  tecnico: `Você é um revisor jurídico técnico especializado. Foque EXCLUSIVAMENTE em: precisão terminológica, adequação ao tipo de peça, correção de conceitos jurídicos, alinhamento com jurisprudência, verificação de citações legais, detecção de inconsistências jurídicas, contradições internas e redundâncias. NÃO corrija gramática simples.`,
  linguistico: `Você é um revisor linguístico especializado em textos jurídicos. Foque EXCLUSIVAMENTE em: ortografia, gramática, concordância verbal e nominal, regência, pontuação, repetição excessiva, vícios de linguagem, clareza, simplificação de frases complexas, eliminação de ambiguidades e fluidez textual. NÃO analise aspectos técnico-jurídicos.`,
  organizacional: `Você é um revisor de estilo organizacional. Harmonize o texto para manter uniformidade de tom, vocabulário jurídico, conectores, estrutura de parágrafos, estilo de citações e numeração. Detecte trechos com estilos divergentes e sugira padronização terminológica.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organization_id, draft_id, review_mode, content, piece_type, court } = await req.json();

    if (!organization_id || !content) {
      return new Response(JSON.stringify({ error: "organization_id and content required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Aggregate context from draft/process
    let extraContext = "";
    if (draft_id) {
      const { data: draft } = await supabase
        .from("drafts")
        .select("title, piece_type, process_id, instructions")
        .eq("id", draft_id)
        .maybeSingle();
      if (draft) {
        extraContext += `\n## Minuta\nTítulo: ${draft.title}\nTipo: ${draft.piece_type}\nInstruções originais: ${draft.instructions || "N/A"}\n`;
        if (draft.process_id) {
          const { data: proc } = await supabase
            .from("processes")
            .select("title, number, process_class, subject, court, phase")
            .eq("id", draft.process_id)
            .maybeSingle();
          if (proc) {
            extraContext += `\n## Processo\nTítulo: ${proc.title}\nNúmero: ${proc.number || "N/A"}\nClasse: ${proc.process_class || "N/A"}\nAssunto: ${proc.subject || "N/A"}\nTribunal: ${proc.court || "N/A"}\nFase: ${proc.phase || "N/A"}\n`;
          }
        }
      }
    }

    // Organization style instructions
    const { data: orgSettings } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organization_id)
      .maybeSingle();

    if (orgSettings) {
      extraContext += `\n## Organização: ${orgSettings.name}\n`;
    }

    const mode = review_mode || "automatico";
    const systemPrompt = (MODE_PROMPTS[mode] || MODE_PROMPTS.automatico) +
      `\n\nRegras obrigatórias:\n- NÃO altere fatos do processo\n- PRESERVE citações legais e jurisprudenciais\n- ALERTE sobre inconsistências fáticas\n- Indique o nível de severidade de cada item\n- Cada sugestão deve ter explicação clara do motivo da correção`;

    const userPrompt = `${extraContext}${piece_type ? `\nTipo de peça: ${piece_type}` : ""}${court ? `\nTribunal: ${court}` : ""}\n\n## Texto para revisão:\n\n${content}`;

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
              name: "return_review",
              description: "Return structured legal review results",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "Resumo geral da revisão" },
                  score: { type: "integer", description: "Pontuação de qualidade geral de 0 a 100" },
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["linguistic", "clarity", "cohesion", "technical"], description: "Camada da revisão" },
                        severity: { type: "string", enum: ["info", "warning", "error"], description: "Gravidade" },
                        original: { type: "string", description: "Trecho original problemático" },
                        suggestion: { type: "string", description: "Texto corrigido sugerido" },
                        explanation: { type: "string", description: "Explicação do motivo da correção" },
                        category: { type: "string", enum: ["grammar", "terminology", "structure", "citation", "inconsistency", "redundancy", "style", "clarity", "cohesion"], description: "Categoria específica" },
                      },
                      required: ["type", "severity", "original", "suggestion", "explanation", "category"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["summary", "score", "suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_review" } },
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
    let result = { summary: "", score: 0, suggestions: [] as any[] };

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        result = JSON.parse(toolCall.function.arguments);
      } catch {
        console.error("Failed to parse tool call arguments");
      }
    }

    // Persist review
    const { data: review } = await supabase.from("legal_reviews").insert({
      organization_id,
      draft_id: draft_id || null,
      user_id: "00000000-0000-0000-0000-000000000000", // will be overridden by client if auth header present
      review_mode: mode,
      suggestions: result.suggestions,
      summary: result.summary,
      score: result.score,
      status: "pending",
    }).select("id").maybeSingle();

    // Audit logs
    await supabase.from("audit_logs").insert({
      action: "legal_review_performed",
      user_id: null,
      organization_id,
      resource_type: "legal_review",
      resource_id: review?.id || draft_id || null,
      metadata: {
        review_mode: mode,
        draft_id,
        score: result.score,
        suggestion_count: result.suggestions.length,
        issue_count: result.suggestions.filter((s: any) => s.severity === "error").length,
      },
    });

    // Log issues detected
    const issues = result.suggestions.filter((s: any) => s.severity === "error" || s.type === "technical");
    if (issues.length > 0) {
      await supabase.from("audit_logs").insert({
        action: "legal_review_issue_detected",
        user_id: null,
        organization_id,
        resource_type: "legal_review",
        resource_id: review?.id || draft_id || null,
        metadata: { issue_count: issues.length, issues: issues.map((i: any) => ({ type: i.type, category: i.category, severity: i.severity })) },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("review-legal error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
