import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { reportId, organizationId, reportType, title } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Gather org data for context
    const [processes, deadlines, invoices] = await Promise.all([
      supabase.from("processes").select("id,title,status,area").eq("organization_id", organizationId).limit(50),
      supabase.from("deadlines").select("id,title,status,priority,due_date").eq("organization_id", organizationId).limit(50),
      supabase.from("invoices").select("id,status,amount_cents,due_date").eq("organization_id", organizationId).limit(50),
    ]);

    const context = {
      processes: processes.data?.length || 0,
      activeProcesses: processes.data?.filter((p: any) => p.status === "active").length || 0,
      deadlines: deadlines.data?.length || 0,
      overdueDeadlines: deadlines.data?.filter((d: any) => d.status === "pending" && new Date(d.due_date) < new Date()).length || 0,
      totalRevenue: invoices.data?.filter((i: any) => i.status === "paid").reduce((sum: number, i: any) => sum + i.amount_cents, 0) || 0,
      pendingInvoices: invoices.data?.filter((i: any) => i.status === "pending").length || 0,
    };

    const systemPrompt = `Você é um analista jurídico especializado. Gere um relatório detalhado e profissional em português brasileiro.
Tipo do relatório: ${reportType}
Título: ${title}

Dados da organização:
- ${context.processes} processos (${context.activeProcesses} ativos)
- ${context.deadlines} prazos (${context.overdueDeadlines} vencidos)
- Receita total: R$ ${(context.totalRevenue / 100).toFixed(2)}
- ${context.pendingInvoices} faturas pendentes

Estruture o relatório com seções claras, insights e recomendações.`;

    const endpoint = Deno.env.get("AZURE_OPENAI_ENDPOINT")!;
    const apiKey = Deno.env.get("AZURE_OPENAI_API_KEY")!;

    const aiResponse = await fetch(`${endpoint}/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-02-15-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Gere o relatório "${title}" do tipo "${reportType}" com base nos dados fornecidos.` },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "Erro ao gerar relatório.";
    const summary = content.substring(0, 200) + "...";

    await supabase.from("ai_reports").update({
      content,
      summary,
      status: "completed",
      generated_at: new Date().toISOString(),
      data_snapshot: context,
    }).eq("id", reportId);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error generating AI report:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
