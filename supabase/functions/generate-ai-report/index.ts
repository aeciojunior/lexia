import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth, requireOrgMember } from "../_shared/auth.ts";
import { hfChat, requireHfToken } from "../_shared/huggingface.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;

    const { reportId, organizationId, reportType, title } = await req.json();

    if (!organizationId) {
      return new Response(JSON.stringify({ error: "organizationId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const memberError = await requireOrgMember(auth.supabase, auth.userId, organizationId);
    if (memberError) return memberError;

    const supabase = auth.supabase;

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

    requireHfToken();

    const aiResponse = await hfChat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Gere o relatório "${title}" do tipo "${reportType}" com base nos dados fornecidos.` },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("HF error:", aiResponse.status, errText);
      throw new Error("Erro na geração do relatório");
    }

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
