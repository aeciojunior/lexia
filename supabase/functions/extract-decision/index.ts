import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { process_id, decision_text, event_id } = await req.json();
    if (!process_id || !decision_text) {
      return new Response(JSON.stringify({ error: "process_id e decision_text são obrigatórios." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Fetch process for org context
    const { data: process, error: procError } = await supabaseUser
      .from("processes")
      .select("id, organization_id, number, title, classe, assunto, valor_causa")
      .eq("id", process_id)
      .single();

    if (procError || !process) {
      return new Response(JSON.stringify({ error: "Processo não encontrado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    const orgId = process.organization_id;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "IA não configurada." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const systemPrompt = `Você é um especialista jurídico brasileiro em análise de decisões judiciais. Analise o texto da decisão e extraia informações estruturadas. Retorne APENAS a chamada da função, sem texto adicional.

Regras de segmentação:
- RELATÓRIO: texto antes de marcadores como "Passo a decidir", "Fundamento e decido", "É o relatório. Decido."
- FUNDAMENTOS: entre o relatório e o dispositivo, contém argumentos jurídicos, artigos de lei, jurisprudência
- DISPOSITIVO: após marcadores como "Ante o exposto", "Diante do exposto", "Isso posto", "Julgo..."
- Se não encontrar marcadores claros, use heurísticas: últimos 20-30% = dispositivo

Regras de resultado:
- "Julgo procedente" → procedente
- "Julgo improcedente" → improcedente  
- "Parcialmente procedente" → parcialmente_procedente
- "Defiro" → deferido
- "Indefiro" → indeferido
- "Dou provimento" → provimento
- "Nego provimento" → negado
- Se contém determinação sem julgamento de mérito → determinacao

Regras de prazos:
- Identificar expressões como "prazo de X dias", "no prazo de X dias", "em 48 horas"
- Classificar tipo: manifestacao, recurso, pagamento, cumprimento, outro`;

    const userPrompt = `Analise a seguinte decisão judicial do processo ${process.number} (${process.title}):\n\n${decision_text.substring(0, 8000)}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
              name: "extract_decision",
              description: "Extrai dados estruturados de uma decisão judicial brasileira.",
              parameters: {
                type: "object",
                properties: {
                  decision_type: {
                    type: "string",
                    enum: ["sentenca", "decisao_interlocutoria", "despacho", "acordao", "liminar"],
                    description: "Tipo da decisão",
                  },
                  result: {
                    type: "string",
                    enum: ["procedente", "improcedente", "parcialmente_procedente", "deferido", "indeferido", "provimento", "negado", "determinacao"],
                    description: "Resultado/dispositivo da decisão",
                  },
                  fundamentals: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "Trecho ou resumo do fundamento" },
                        type: { type: "string", enum: ["artigo_de_lei", "jurisprudencia", "doutrina", "fato_relevante", "argumento_juridico"], description: "Tipo do fundamento" },
                      },
                      required: ["text", "type"],
                      additionalProperties: false,
                    },
                    description: "Lista de fundamentos identificados",
                  },
                  deadlines: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["manifestacao", "recurso", "pagamento", "cumprimento", "outro"], description: "Tipo do prazo" },
                        days: { type: "number", description: "Quantidade de dias" },
                        description: { type: "string", description: "Descrição do prazo" },
                      },
                      required: ["type", "days"],
                      additionalProperties: false,
                    },
                    description: "Prazos identificados na decisão",
                  },
                  dispositivo: {
                    type: "string",
                    description: "Texto integral do dispositivo (parte final com comandos/determinações)",
                  },
                  confidence: {
                    type: "number",
                    description: "Confiança da extração de 0 a 1",
                  },
                  justification: {
                    type: "string",
                    description: "Explicação resumida dos trechos e padrões que justificam cada extração, em português.",
                  },
                },
                required: ["decision_type", "result", "fundamentals", "deadlines", "dispositivo", "confidence", "justification"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_decision" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns minutos." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 429,
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos ao workspace." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 402,
        });
      }

      return new Response(JSON.stringify({ error: "Erro ao extrair decisão." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(aiData));
      return new Response(JSON.stringify({ error: "IA não retornou extração válida." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const extraction = JSON.parse(toolCall.function.arguments);

    const extractionData = {
      process_id,
      organization_id: orgId,
      event_id: event_id || null,
      decision_type: extraction.decision_type,
      result: extraction.result,
      fundamentals: extraction.fundamentals,
      deadlines_extracted: extraction.deadlines,
      dispositivo: extraction.dispositivo,
      confidence: Math.min(1, Math.max(0, extraction.confidence)),
      justification: extraction.justification,
      origin: "automatica",
      extracted_by: user.id,
    };

    // Upsert by process_id + event_id
    const query = event_id
      ? supabaseAdmin.from("decision_extractions").select("id").eq("process_id", process_id).eq("event_id", event_id).maybeSingle()
      : supabaseAdmin.from("decision_extractions").select("id").eq("process_id", process_id).is("event_id", null).maybeSingle();

    const { data: existing } = await query;

    if (existing) {
      await supabaseAdmin.from("decision_extractions").update(extractionData).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("decision_extractions").insert(extractionData);
    }

    // Log
    await supabaseAdmin.from("decision_extraction_logs").insert({
      process_id,
      organization_id: orgId,
      event_id: event_id || null,
      decision_type: extraction.decision_type,
      result: extraction.result,
      fundamentals: extraction.fundamentals,
      deadlines_extracted: extraction.deadlines,
      dispositivo: extraction.dispositivo,
      confidence: extraction.confidence,
      origin: "automatica",
      user_id: user.id,
    });

    // RF-041: Auto-create deadlines for high-confidence extractions
    const createdDeadlines: string[] = [];
    if (Array.isArray(extraction.deadlines) && extraction.deadlines.length > 0 && extraction.confidence >= 0.8) {
      // Get the extraction record id
      const lookupQuery = event_id
        ? supabaseAdmin.from("decision_extractions").select("id").eq("process_id", process_id).eq("event_id", event_id).maybeSingle()
        : supabaseAdmin.from("decision_extractions").select("id").eq("process_id", process_id).is("event_id", null).maybeSingle();
      const { data: extractionRecord } = await lookupQuery;

      for (const dl of extraction.deadlines) {
        if (!dl.days || dl.days <= 0) continue;

        // Calculate due date from now
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + dl.days);
        const dueDateStr = dueDate.toISOString().split("T")[0];

        // Priority based on days
        let priority = "low";
        if (dl.days <= 3) priority = "critical";
        else if (dl.days <= 7) priority = "high";
        else if (dl.days <= 15) priority = "medium";

        const typeLabels: Record<string, string> = {
          manifestacao: "Manifestação",
          recurso: "Recurso",
          pagamento: "Pagamento",
          cumprimento: "Cumprimento",
          outro: "Outro",
        };
        const typeLabel = typeLabels[dl.type] || dl.type || "Prazo";

        const { data: newDeadline } = await supabaseAdmin.from("deadlines").insert({
          process_id,
          organization_id: orgId,
          user_id: user.id,
          title: `${typeLabel} — ${dl.days} dias`,
          description: dl.description || `Prazo extraído automaticamente da decisão (confiança ${Math.round(extraction.confidence * 100)}%).`,
          due_date: dueDateStr,
          priority,
          status: "pending",
          extraction_id: extractionRecord?.id || null,
        }).select("id").maybeSingle();

        if (newDeadline) createdDeadlines.push(newDeadline.id);
      }
    }

    return new Response(JSON.stringify({ ...extraction, created_deadlines: createdDeadlines }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("extract-decision error:", error);
    return new Response(JSON.stringify({ error: "Erro interno ao extrair decisão." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
