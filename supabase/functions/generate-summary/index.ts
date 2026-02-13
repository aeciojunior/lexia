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

    const { process_id, summary_type = "processo", style = "executivo", detail_level = "medio", focus = [] } = await req.json();
    if (!process_id) {
      return new Response(JSON.stringify({ error: "process_id é obrigatório." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Fetch process
    const { data: process, error: procErr } = await supabaseUser
      .from("processes")
      .select("*")
      .eq("id", process_id)
      .single();
    if (procErr || !process) {
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

    // Collect context from all AI modules in parallel
    const [classificationRes, extractionRes, deadlinesRes, docsRes, eventsRes] = await Promise.all([
      supabaseAdmin.from("process_classifications").select("*").eq("process_id", process_id).maybeSingle(),
      supabaseAdmin.from("decision_extractions").select("*").eq("process_id", process_id).order("created_at", { ascending: false }).limit(3),
      supabaseAdmin.from("deadlines").select("*").eq("process_id", process_id).eq("status", "pending").order("due_date", { ascending: true }).limit(10),
      supabaseAdmin.from("documents").select("id, file_name, category, notes").eq("process_id", process_id).order("created_at", { ascending: false }).limit(10),
      supabaseAdmin.from("process_events").select("id, title, event_type, event_date, description").eq("process_id", process_id).order("event_date", { ascending: false }).limit(15),
    ]);

    const classification = classificationRes.data;
    const decisions = extractionRes.data || [];
    const deadlines = deadlinesRes.data || [];
    const documents = docsRes.data || [];
    const events = eventsRes.data || [];

    // Build context block
    const contextParts: string[] = [];

    contextParts.push(`PROCESSO: ${process.number} — ${process.title}\nCliente: ${process.client_name}\nTipo: ${process.type} | Status: ${process.status} | Risco: ${process.risk_level || "não definido"}\nForo: ${process.foro || "—"} | Vara: ${process.vara || "—"} | Classe: ${process.classe || "—"} | Fase: ${process.fase || "—"}`);

    if (process.valor_causa) contextParts.push(`Valor da causa: R$ ${Number(process.valor_causa).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    if (process.description) contextParts.push(`Descrição: ${process.description}`);

    if (classification) {
      contextParts.push(`\nCLASSIFICAÇÃO IA (RF-034):\nTipo: ${classification.process_type} (confiança ${Math.round((classification.confidence || 0) * 100)}%)\nÁrea: ${classification.legal_area}\nRisco: ${classification.risk_level}\nUrgência: ${classification.urgency}\nJustificativa: ${classification.justification || "—"}`);
    }

    if (decisions.length > 0) {
      contextParts.push(`\nDECISÕES (RF-040):`);
      for (const d of decisions) {
        contextParts.push(`- ${d.decision_type}: ${d.result} (confiança ${Math.round((d.confidence || 0) * 100)}%)\n  Dispositivo: ${d.dispositivo || "—"}`);
        if (Array.isArray(d.fundamentals) && d.fundamentals.length > 0) {
          contextParts.push(`  Fundamentos: ${d.fundamentals.map((f: any) => f.text).join("; ")}`);
        }
      }
    }

    if (deadlines.length > 0) {
      contextParts.push(`\nPRAZOS ATIVOS (RF-041):`);
      for (const dl of deadlines) {
        const daysLeft = Math.ceil((new Date(dl.due_date).getTime() - Date.now()) / 86400000);
        contextParts.push(`- ${dl.title}: vence em ${dl.due_date} (${daysLeft > 0 ? `${daysLeft} dias restantes` : "VENCIDO"}) — Prioridade: ${dl.priority}`);
      }
    }

    if (documents.length > 0) {
      contextParts.push(`\nDOCUMENTOS (RF-042):`);
      for (const doc of documents) {
        contextParts.push(`- ${doc.file_name} [${doc.category}]${doc.notes ? ` — ${doc.notes}` : ""}`);
      }
    }

    if (events.length > 0) {
      contextParts.push(`\nEVENTOS RECENTES (linha do tempo):`);
      for (const ev of events) {
        contextParts.push(`- ${ev.event_date}: ${ev.title} (${ev.event_type})${ev.description ? ` — ${ev.description}` : ""}`);
      }
    }

    const fullContext = contextParts.join("\n");

    // Style instructions
    const styleInstructions: Record<string, string> = {
      juridico_formal: "Use linguagem técnico-jurídica formal, com referências processuais e termos do CPC/CPP.",
      executivo: "Use linguagem clara e direta, focada em riscos, prazos e próximos passos. Evite juridiquês excessivo.",
      bullets: "Apresente em bullet points organizados por seção (situação, riscos, prazos, decisões, próximos passos).",
      narrativo: "Redija em forma narrativa fluida, como um parecer resumido.",
      tecnico: "Use termos técnicos precisos com referências a artigos e jurisprudência quando disponíveis.",
    };

    const detailInstructions: Record<string, string> = {
      curto: "Limite a 3-5 linhas no máximo.",
      medio: "Escreva 1-2 parágrafos (ou 8-12 bullets se estilo bullets).",
      completo: "Seja detalhado, cobrindo todos os aspectos disponíveis.",
    };

    const focusInstructions = focus.length > 0
      ? `Foque principalmente em: ${focus.join(", ")}.`
      : "Cubra todos os aspectos relevantes proporcionalmente.";

    const systemPrompt = `Você é um assistente jurídico especializado em resumos processuais brasileiros. Gere um resumo do tipo "${summary_type}" com base nos dados fornecidos.

Regras:
1. ${styleInstructions[style] || styleInstructions.executivo}
2. ${detailInstructions[detail_level] || detailInstructions.medio}
3. ${focusInstructions}
4. Baseie-se SOMENTE nos dados fornecidos. Não invente fatos.
5. Mencione scores de confiança da IA quando relevantes.
6. Destaque prazos vencidos ou críticos quando existentes.
7. Retorne APENAS a chamada da função com o resumo estruturado.`;

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
          { role: "user", content: `Gere o resumo com base nos seguintes dados:\n\n${fullContext}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_summary",
              description: "Gera um resumo estruturado de um processo jurídico.",
              parameters: {
                type: "object",
                properties: {
                  summary_text: {
                    type: "string",
                    description: "Texto do resumo gerado",
                  },
                  confidence: {
                    type: "number",
                    description: "Confiança geral do resumo (0-1)",
                  },
                  relevant_excerpts: {
                    type: "array",
                    items: { type: "string" },
                    description: "Trechos-chave dos dados usados no resumo",
                  },
                  highlights: {
                    type: "array",
                    items: { type: "string" },
                    description: "Destaques críticos (prazos urgentes, riscos altos, etc.)",
                  },
                },
                required: ["summary_text", "confidence", "relevant_excerpts", "highlights"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_summary" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429,
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402,
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao gerar resumo." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call:", JSON.stringify(aiData));
      return new Response(JSON.stringify({ error: "IA não retornou resumo válido." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    // Save to DB
    const summaryData = {
      process_id,
      organization_id: orgId,
      summary_type,
      config: { style, detail_level, focus },
      summary_text: result.summary_text,
      relevant_excerpts: result.relevant_excerpts,
      confidence: Math.min(1, Math.max(0, result.confidence)),
      origin: "automatica",
      created_by: user.id,
    };

    await supabaseAdmin.from("process_summaries").insert(summaryData);

    return new Response(JSON.stringify({
      ...result,
      summary_type,
      config: { style, detail_level, focus },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-summary error:", error);
    return new Response(JSON.stringify({ error: "Erro interno ao gerar resumo." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
