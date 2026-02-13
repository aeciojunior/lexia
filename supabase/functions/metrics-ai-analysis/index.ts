import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { metrics } = await req.json();
    if (!metrics) {
      return new Response(JSON.stringify({ error: "metrics payload required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um analista de produtividade jurídica. Analise os dados operacionais de um escritório de advocacia e forneça insights acionáveis.

Responda SOMENTE com JSON válido (sem markdown, sem code fences), no formato:
{
  "summary": "Resumo executivo em 2-3 frases",
  "bottlenecks": [
    { "area": "nome da área", "severity": "high|medium|low", "description": "descrição do gargalo", "suggestion": "ação recomendada" }
  ],
  "redistribution": [
    { "from": "contexto atual", "to": "sugestão", "reason": "motivo" }
  ],
  "predictions": [
    { "metric": "nome", "trend": "up|down|stable", "description": "previsão" }
  ],
  "score": 0-100
}`;

    const userPrompt = `Analise as seguintes métricas do escritório:

PROCESSOS:
- Ativos: ${metrics.activeProcesses}
- Por status: ${JSON.stringify(metrics.processByStatus)}
- Por tipo: ${JSON.stringify(metrics.processByType)}

TAREFAS:
- Concluídas: ${metrics.completedTasks}
- Pendentes: ${metrics.pendingTasks}
- Atrasadas: ${metrics.overdueTasks}
- Por usuário: ${JSON.stringify(metrics.tasksByUser?.slice(0, 5))}

PRAZOS:
- Pendentes: ${metrics.pendingDeadlines}
- Vencidos: ${metrics.overdueDeadlines}
- Taxa de cumprimento: ${metrics.complianceRate}%

AUDIÊNCIAS:
- Futuras: ${metrics.futureHearings}
- Realizadas: ${metrics.pastHearings}

TIMES:
${JSON.stringify(metrics.teamsData?.slice(0, 5))}

TENDÊNCIA MENSAL:
${JSON.stringify(metrics.monthlyData)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        temperature: 0.4,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos no workspace Lovable." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("Lovable AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "{}";

    let analysis;
    try {
      // Strip potential markdown code fences
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      analysis = { summary: content, bottlenecks: [], redistribution: [], predictions: [], score: 50 };
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("metrics-ai-analysis error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
