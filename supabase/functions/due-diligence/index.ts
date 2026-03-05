import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, target_name, context, organization_id } = await req.json();
    if (!target_name || !organization_id) {
      return new Response(JSON.stringify({ error: "target_name e organization_id são obrigatórios." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch related contracts
    const { data: contracts } = await supabase.from("contracts").select("title, contract_type, status, amount_cents, clauses, start_date, end_date").eq("organization_id", organization_id).eq("status", "active").limit(10);

    // Fetch risks
    const { data: risks } = await supabase.from("risks").select("title, severity, category, description").eq("organization_id", organization_id).eq("status", "open").limit(10);

    // Fetch compliance incidents
    const { data: incidents } = await supabase.from("compliance_incidents").select("title, category, severity, status").eq("organization_id", organization_id).limit(5);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const typeLabels: Record<string, string> = {
      corporate: "Operação Societária", ma: "Fusão e Aquisição",
      internal_audit: "Auditoria Interna", vendor: "Onboarding de Fornecedor",
      contract_risk: "Risco Contratual", compliance: "Compliance Regulatório",
    };

    const systemPrompt = `Você é um especialista em due diligence jurídica do sistema LexIA. Realize uma análise completa e estruturada.

A análise DEVE conter as seguintes seções em Markdown:
## 1. Resumo Executivo
## 2. Checklist de Due Diligence
Lista de itens verificados com status (✅ Conforme / ⚠️ Atenção / ❌ Risco)
## 3. Riscos Jurídicos Identificados
Para cada risco: descrição, impacto jurídico, impacto financeiro, urgência
## 4. Riscos Regulatórios
## 5. Inconsistências Documentais
## 6. Obrigações Pendentes
## 7. Recomendações
## 8. Limitações da Análise

REGRAS:
- NÃO emita parecer conclusivo
- Use termos qualitativos (alto/médio/baixo)
- Indique limitações quando dados forem insuficientes
- Mantenha tom técnico e profissional`;

    const userPrompt = `Due Diligence: ${typeLabels[type] || type}
Alvo: ${target_name}
${context ? `\nContexto:\n${context}` : ""}
\nContratos ativos: ${JSON.stringify(contracts || [])}
Riscos abertos: ${JSON.stringify(risks || [])}
Incidentes de compliance: ${JSON.stringify(incidents || [])}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("Erro no gateway de IA");
    }

    const aiData = await response.json();
    const report = aiData.choices?.[0]?.message?.content || "Não foi possível gerar o relatório.";

    return new Response(JSON.stringify({ report }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("due-diligence error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
