import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSystemPrompt(comparisonType: string): string {
  const base = `Você é um especialista jurídico brasileiro. Analise os dois textos fornecidos e retorne uma análise estruturada.`;

  const typeInstructions: Record<string, string> = {
    contract: `Foque na comparação cláusula a cláusula: obrigações, prazos, multas, garantias, rescisão, confidencialidade, foro, responsabilidade, LGPD.`,
    legal_piece: `Foque na comparação de peças jurídicas: narrativa dos fatos, fundamentos constitucionais e infraconstitucionais, jurisprudência, pedidos principais e subsidiários, argumentos de mérito e preliminares.`,
    general: `Faça uma comparação geral identificando diferenças literais, estruturais e semânticas.`,
  };

  return `${base}
${typeInstructions[comparisonType] || typeInstructions.general}

Responda APENAS usando a tool "comparison_analysis" fornecida.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user via getClaims
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { textA, textB, comparisonType = "general", labelA = "Texto A", labelB = "Texto B", organizationId, sourceAId, sourceBId } = await req.json();

    if (!textA || !textB || !organizationId) {
      return new Response(JSON.stringify({ error: "textA, textB e organizationId são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify org membership
    const { data: isMember } = await supabase.rpc("is_org_member", {
      _user_id: user.id,
      _org_id: organizationId,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Sem acesso à organização" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Truncate texts
    const maxLen = 50000;
    const tA = textA.slice(0, maxLen);
    const tB = textB.slice(0, maxLen);

    // Call Lovable AI Gateway with tool calling for structured output
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: getSystemPrompt(comparisonType) },
          {
            role: "user",
            content: `## TEXTO A (${labelA}):\n${tA}\n\n## TEXTO B (${labelB}):\n${tB}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "comparison_analysis",
              description: "Retorna análise estruturada da comparação entre dois textos jurídicos",
              parameters: {
                type: "object",
                properties: {
                  resumo: { type: "string", description: "Resumo geral das diferenças" },
                  alteracoes_criticas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        trecho: { type: "string" },
                        tipo: { type: "string", enum: ["adição", "remoção", "modificação"] },
                        descricao: { type: "string" },
                        risco: { type: "string", enum: ["alto", "médio", "baixo"] },
                      },
                      required: ["trecho", "tipo", "descricao", "risco"],
                    },
                  },
                  alteracoes_semanticas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        original: { type: "string" },
                        modificado: { type: "string" },
                        impacto: { type: "string" },
                      },
                      required: ["original", "modificado", "impacto"],
                    },
                  },
                  alteracoes_juridicas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        aspecto: { type: "string" },
                        antes: { type: "string" },
                        depois: { type: "string" },
                        impacto_juridico: { type: "string" },
                        risco: { type: "string", enum: ["alto", "médio", "baixo"] },
                      },
                      required: ["aspecto", "antes", "depois", "impacto_juridico", "risco"],
                    },
                  },
                  sugestoes_harmonizacao: {
                    type: "array",
                    items: { type: "string" },
                  },
                  risco_geral: { type: "string", enum: ["alto", "médio", "baixo", "nenhum"] },
                },
                required: ["resumo", "alteracoes_criticas", "alteracoes_semanticas", "alteracoes_juridicas", "sugestoes_harmonizacao", "risco_geral"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "comparison_analysis" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido, tente novamente em breve." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);
      throw new Error("Erro no gateway de IA");
    }

    const aiData = await aiResponse.json();
    let analysis: any = {};
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        analysis = JSON.parse(toolCall.function.arguments);
      }
    } catch (e) {
      console.error("Failed to parse AI tool call:", e);
    }

    const riskLevel = analysis.risco_geral === "nenhum" ? null : analysis.risco_geral || null;

    // Save comparison
    const { data: comparison, error: insertError } = await supabase
      .from("text_comparisons")
      .insert({
        organization_id: organizationId,
        user_id: user.id,
        comparison_type: comparisonType,
        text_a_label: labelA,
        text_b_label: labelB,
        text_a: tA,
        text_b: tB,
        ai_analysis: analysis,
        source_a_id: sourceAId || null,
        source_b_id: sourceBId || null,
        risk_level: riskLevel,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Erro ao salvar comparação");
    }

    // Audit logs
    const auditActions = ["text_comparison_performed"];
    if (analysis.alteracoes_semanticas?.length > 0) {
      auditActions.push("text_comparison_semantic_change_detected");
    }
    if (analysis.alteracoes_juridicas?.length > 0) {
      auditActions.push("text_comparison_legal_change_detected");
    }

    for (const action of auditActions) {
      await supabase.from("audit_logs").insert({
        action,
        user_id: user.id,
        organization_id: organizationId,
        resource_type: "text_comparison",
        resource_id: comparison.id,
        metadata: {
          comparison_type: comparisonType,
          risk_level: riskLevel,
          label_a: labelA,
          label_b: labelB,
        },
      });
    }

    return new Response(JSON.stringify({ comparison, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("compare-texts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
