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
    financial: `Foque na comparação de valores financeiros: valores numéricos, fórmulas de cálculo, índices de correção (IPCA, INPC, SELIC), juros aplicados, datas de cálculo, parcelas, totais e subtotais. Identifique erros de cálculo e inconsistências. Analise o impacto jurídico de cada diferença financeira.`,
    multilingual: `Compare documentos em idiomas diferentes. Identifique equivalências semânticas, omissões na tradução, adições não autorizadas, inconsistências terminológicas e riscos jurídicos decorrentes de diferenças entre as versões. Use termos técnicos jurídicos apropriados em cada idioma.`,
    fraud_detection: `Analise os textos buscando indícios de fraude ou adulteração documental. Use APENAS termos qualitativos como "indício", "suspeita", "inconsistência". NUNCA afirme fraude de forma conclusiva. Analise: inconsistências de conteúdo, divergências entre versões, alterações suspeitas de datas/valores/assinaturas, padrões de edição incomuns. Indique quando dados são insuficientes para análise.`,
  };

  return `${base}
${typeInstructions[comparisonType] || typeInstructions.general}

Responda APENAS usando a tool "comparison_analysis" fornecida. Calcule a similaridade percentual entre os textos (0-100). Identifique trechos idênticos, equivalentes e preservados como similaridades.`;
}

function buildToolSchema(comparisonType: string) {
  const baseProperties: Record<string, any> = {
    resumo: { type: "string", description: "Resumo geral das diferenças" },
    similaridade_percentual: { type: "number", description: "Percentual de similaridade entre os textos (0-100)" },
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
    similaridades: {
      type: "array",
      items: {
        type: "object",
        properties: {
          trecho: { type: "string" },
          tipo: { type: "string", enum: ["identico", "equivalente", "preservado"] },
        },
        required: ["trecho", "tipo"],
      },
    },
    sugestoes_harmonizacao: {
      type: "array",
      items: { type: "string" },
    },
    risco_geral: { type: "string", enum: ["alto", "médio", "baixo", "nenhum"] },
    qualidade_ocr: { type: "string", enum: ["boa", "parcial", "insuficiente", "n/a"] },
  };

  const requiredFields = ["resumo", "similaridade_percentual", "alteracoes_criticas", "alteracoes_semanticas", "alteracoes_juridicas", "similaridades", "sugestoes_harmonizacao", "risco_geral"];

  // Add type-specific fields
  if (comparisonType === "financial") {
    baseProperties.analise_financeira = {
      type: "object",
      properties: {
        diferencas_valores: {
          type: "array",
          items: {
            type: "object",
            properties: {
              campo: { type: "string" },
              valor_a: { type: "string" },
              valor_b: { type: "string" },
              diferenca: { type: "string" },
              impacto: { type: "string" },
            },
            required: ["campo", "valor_a", "valor_b", "diferenca", "impacto"],
          },
        },
        indices_alterados: {
          type: "array",
          items: {
            type: "object",
            properties: {
              indice_original: { type: "string" },
              indice_novo: { type: "string" },
              impacto: { type: "string" },
            },
            required: ["indice_original", "indice_novo", "impacto"],
          },
        },
        impacto_financeiro: { type: "string" },
        erros_calculo: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["diferencas_valores", "indices_alterados", "impacto_financeiro", "erros_calculo"],
    };
    requiredFields.push("analise_financeira");
  }

  if (comparisonType === "multilingual") {
    baseProperties.analise_multilingue = {
      type: "object",
      properties: {
        idioma_a: { type: "string" },
        idioma_b: { type: "string" },
        omissoes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              trecho_original: { type: "string" },
              idioma: { type: "string" },
              impacto: { type: "string" },
            },
            required: ["trecho_original", "idioma", "impacto"],
          },
        },
        adicoes_nao_autorizadas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              trecho: { type: "string" },
              idioma: { type: "string" },
              impacto: { type: "string" },
            },
            required: ["trecho", "idioma", "impacto"],
          },
        },
        inconsistencias_terminologicas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              termo_a: { type: "string" },
              termo_b: { type: "string" },
              sugestao: { type: "string" },
            },
            required: ["termo_a", "termo_b", "sugestao"],
          },
        },
      },
      required: ["idioma_a", "idioma_b", "omissoes", "adicoes_nao_autorizadas", "inconsistencias_terminologicas"],
    };
    requiredFields.push("analise_multilingue");
  }

  if (comparisonType === "fraud_detection") {
    baseProperties.indicios_fraude = {
      type: "array",
      items: {
        type: "object",
        properties: {
          tipo: { type: "string" },
          descricao: { type: "string" },
          pagina: { type: "string" },
          probabilidade: { type: "string", enum: ["alta", "media", "baixa"] },
          recomendacao: { type: "string" },
        },
        required: ["tipo", "descricao", "probabilidade", "recomendacao"],
      },
    };
    requiredFields.push("indicios_fraude");
  }

  return {
    type: "object",
    properties: baseProperties,
    required: requiredFields,
    additionalProperties: false,
  };
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

    const {
      textA, textB,
      comparisonType = "general",
      labelA = "Texto A", labelB = "Texto B",
      organizationId,
      sourceAId, sourceBId,
      fileAFormat, fileBFormat,
      fileASize, fileBSize,
    } = await req.json();

    if (!textA || !textB || !organizationId) {
      return new Response(JSON.stringify({ error: "textA, textB e organizationId são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isMember } = await supabase.rpc("is_org_member", {
      _user_id: userId,
      _org_id: organizationId,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Sem acesso à organização" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const maxLen = 50000;
    const tA = textA.slice(0, maxLen);
    const tB = textB.slice(0, maxLen);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const toolSchema = buildToolSchema(comparisonType);

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
              description: "Retorna análise estruturada da comparação entre dois textos/arquivos",
              parameters: toolSchema,
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

    // Build insert payload
    const insertPayload: Record<string, any> = {
      organization_id: organizationId,
      user_id: userId,
      comparison_type: comparisonType,
      text_a_label: labelA,
      text_b_label: labelB,
      text_a: tA,
      text_b: tB,
      ai_analysis: analysis,
      source_a_id: sourceAId || null,
      source_b_id: sourceBId || null,
      risk_level: riskLevel,
      similarity_percent: analysis.similaridade_percentual ?? null,
      file_a_format: fileAFormat || null,
      file_b_format: fileBFormat || null,
      file_a_size_bytes: fileASize || null,
      file_b_size_bytes: fileBSize || null,
    };

    if (analysis.analise_multilingue) {
      insertPayload.detected_languages = [
        analysis.analise_multilingue.idioma_a,
        analysis.analise_multilingue.idioma_b,
      ].filter(Boolean);
    }
    if (analysis.indicios_fraude) {
      insertPayload.fraud_indicators = analysis.indicios_fraude;
    }
    if (analysis.analise_financeira) {
      insertPayload.financial_analysis = analysis.analise_financeira;
    }

    const { data: comparison, error: insertError } = await supabase
      .from("text_comparisons")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Erro ao salvar comparação");
    }

    // Audit logs
    const auditActions: string[] = [];
    
    // Map comparison type to appropriate audit action
    if (comparisonType === "financial") {
      auditActions.push("financial_comparison_performed");
    } else if (comparisonType === "multilingual") {
      auditActions.push("multilingual_comparison_performed");
    } else if (comparisonType === "fraud_detection") {
      auditActions.push("file_comparison_performed");
    } else {
      auditActions.push("file_comparison_performed");
    }

    if (analysis.alteracoes_semanticas?.length > 0) {
      auditActions.push("file_comparison_semantic_change_detected");
    }
    if (analysis.alteracoes_juridicas?.length > 0) {
      auditActions.push("file_comparison_legal_change_detected");
    }
    if (analysis.indicios_fraude?.length > 0) {
      auditActions.push("fraud_indicator_detected");
    }

    for (const action of auditActions) {
      await supabase.from("audit_logs").insert({
        action,
        user_id: userId,
        organization_id: organizationId,
        resource_type: "text_comparison",
        resource_id: comparison.id,
        metadata: {
          comparison_type: comparisonType,
          risk_level: riskLevel,
          label_a: labelA,
          label_b: labelB,
          file_a_format: fileAFormat || null,
          file_b_format: fileBFormat || null,
          similarity_percent: analysis.similaridade_percentual ?? null,
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
