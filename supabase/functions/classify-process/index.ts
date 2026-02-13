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

    // Get user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { process_id } = await req.json();
    if (!process_id) {
      return new Response(JSON.stringify({ error: "process_id obrigatório." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Fetch process data
    const { data: process, error: procError } = await supabaseUser
      .from("processes")
      .select("*")
      .eq("id", process_id)
      .single();

    if (procError || !process) {
      return new Response(JSON.stringify({ error: "Processo não encontrado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    const orgId = process.organization_id;

    // Fetch related data in parallel
    const [eventsRes, deadlinesRes, docsRes, movementsRes] = await Promise.all([
      supabaseUser.from("process_events").select("title, event_type, description, event_date").eq("process_id", process_id).order("event_date", { ascending: false }).limit(20),
      supabaseUser.from("deadlines").select("title, due_date, priority, status").eq("process_id", process_id).order("due_date", { ascending: true }).limit(10),
      supabaseUser.from("documents").select("file_name, category, notes").eq("process_id", process_id).limit(15),
      supabaseUser.from("process_movements").select("title, description, movement_date").eq("process_id", process_id).order("movement_date", { ascending: false }).limit(15),
    ]);

    const events = eventsRes.data || [];
    const deadlines = deadlinesRes.data || [];
    const docs = docsRes.data || [];
    const movements = movementsRes.data || [];

    // Build context for AI
    const now = new Date();
    const upcomingDeadlines = deadlines.filter((d: any) => d.status !== "completed" && new Date(d.due_date) > now);
    const overdueDeadlines = deadlines.filter((d: any) => d.status !== "completed" && new Date(d.due_date + "T23:59:59") < now);

    const contextParts = [
      `Número: ${process.number}`,
      `Título: ${process.title}`,
      `Cliente: ${process.client_name}`,
      process.classe ? `Classe processual: ${process.classe}` : null,
      process.assunto?.length ? `Assunto(s): ${process.assunto.join(", ")}` : null,
      process.foro ? `Foro: ${process.foro}` : null,
      process.vara ? `Vara: ${process.vara}` : null,
      process.fase ? `Fase: ${process.fase}` : null,
      process.valor_causa != null ? `Valor da causa: R$ ${Number(process.valor_causa).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null,
      process.description ? `Descrição: ${process.description}` : null,
      process.partes ? `Partes - Autores: ${(process.partes as any)?.autores?.join(", ") || "N/A"}, Réus: ${(process.partes as any)?.reus?.join(", ") || "N/A"}` : null,
      events.length > 0 ? `\nEventos recentes (${events.length}):\n${events.map((e: any) => `- [${e.event_type}] ${e.title} (${e.event_date}): ${e.description || ""}`).join("\n")}` : null,
      movements.length > 0 ? `\nMovimentações recentes (${movements.length}):\n${movements.map((m: any) => `- ${m.title} (${m.movement_date}): ${m.description || ""}`).join("\n")}` : null,
      docs.length > 0 ? `\nDocumentos (${docs.length}):\n${docs.map((d: any) => `- [${d.category}] ${d.file_name}${d.notes ? `: ${d.notes}` : ""}`).join("\n")}` : null,
      overdueDeadlines.length > 0 ? `\n⚠️ Prazos VENCIDOS (${overdueDeadlines.length}):\n${overdueDeadlines.map((d: any) => `- ${d.title} (venceu em ${d.due_date}, prioridade: ${d.priority})`).join("\n")}` : null,
      upcomingDeadlines.length > 0 ? `\nPrazos próximos (${upcomingDeadlines.length}):\n${upcomingDeadlines.map((d: any) => `- ${d.title} (vence em ${d.due_date}, prioridade: ${d.priority})`).join("\n")}` : null,
    ].filter(Boolean).join("\n");

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "IA não configurada." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const systemPrompt = `Você é um classificador jurídico brasileiro especializado. Analise os dados do processo e classifique-o em 4 dimensões. Retorne APENAS a chamada da função, sem texto adicional.`;

    const userPrompt = `Classifique o seguinte processo jurídico:\n\n${contextParts}\n\nData atual: ${now.toISOString().split("T")[0]}`;

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
              name: "classify_process",
              description: "Classifica um processo jurídico brasileiro em tipo, área, risco e urgência com justificativas.",
              parameters: {
                type: "object",
                properties: {
                  process_type: {
                    type: "string",
                    enum: ["cobranca", "indenizacao", "trabalhista", "penal", "familia", "tributario", "administrativo", "contratual", "consumidor", "ambiental", "outro"],
                    description: "Tipo do processo",
                  },
                  legal_area: {
                    type: "string",
                    enum: ["civel", "trabalhista", "penal", "tributaria", "empresarial", "familia", "consumidor", "administrativo", "ambiental", "outro"],
                    description: "Área jurídica",
                  },
                  risk_level: {
                    type: "string",
                    enum: ["baixo", "medio", "alto", "critico"],
                    description: "Nível de risco estimado",
                  },
                  urgency: {
                    type: "string",
                    enum: ["nenhuma", "moderada", "alta", "imediata"],
                    description: "Nível de urgência",
                  },
                  confidence: {
                    type: "number",
                    description: "Confiança da classificação de 0 a 1",
                  },
                  justification: {
                    type: "string",
                    description: "Justificativas da classificação em português, com bullets. Explique os fatores que levaram a cada classificação.",
                  },
                },
                required: ["process_type", "legal_area", "risk_level", "urgency", "confidence", "justification"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_process" } },
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

      return new Response(JSON.stringify({ error: "Erro ao classificar processo." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(aiData));
      return new Response(JSON.stringify({ error: "IA não retornou classificação válida." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const classification = JSON.parse(toolCall.function.arguments);

    // Upsert classification using service role to bypass RLS for the insert
    const classData = {
      process_id,
      organization_id: orgId,
      process_type: classification.process_type,
      legal_area: classification.legal_area,
      risk_level: classification.risk_level,
      urgency: classification.urgency,
      confidence: Math.min(1, Math.max(0, classification.confidence)),
      justification: classification.justification,
      origin: "automatica",
      classified_by: user.id,
    };

    // Upsert
    const { data: existing } = await supabaseAdmin
      .from("process_classifications")
      .select("id")
      .eq("process_id", process_id)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("process_classifications")
        .update(classData)
        .eq("id", existing.id);
    } else {
      await supabaseAdmin
        .from("process_classifications")
        .insert(classData);
    }

    // Log
    await supabaseAdmin
      .from("process_classification_logs")
      .insert({
        process_id,
        organization_id: orgId,
        process_type: classification.process_type,
        legal_area: classification.legal_area,
        risk_level: classification.risk_level,
        urgency: classification.urgency,
        confidence: classification.confidence,
        justification: classification.justification,
        origin: "automatica",
        user_id: user.id,
      });

    return new Response(JSON.stringify(classification), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("classify-process error:", error);
    return new Response(JSON.stringify({ error: "Erro interno ao classificar processo." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
