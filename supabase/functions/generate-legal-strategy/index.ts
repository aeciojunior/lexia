import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { process_id, organization_id } = await req.json();
    if (!process_id || !organization_id) {
      return new Response(JSON.stringify({ error: "process_id and organization_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch process data
    const { data: process } = await supabase.from("processes").select("*").eq("id", process_id).single();
    if (!process) {
      return new Response(JSON.stringify({ error: "Processo não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch related risks
    const { data: risks } = await supabase.from("risks").select("title, severity, category, description").eq("organization_id", organization_id).eq("status", "open").limit(10);

    // Fetch related precedents
    const { data: precedents } = await supabase.from("internal_precedents").select("title, precedent_type, legal_area, result_obtained, recommendations").eq("organization_id", organization_id).limit(5);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Você é um estrategista jurídico sênior do sistema LexIA. Gere uma estratégia jurídica completa e personalizada para o processo fornecido.

A estratégia DEVE conter as seguintes seções em Markdown:
## 1. Objetivo Jurídico
## 2. Estratégia Processual
- Ordem de pedidos, pedidos subsidiários/alternativos, escolha de rito
## 3. Estratégia Probatória
- Provas a produzir, reforçar, impugnar
## 4. Estratégia Argumentativa
- Tese principal, subsidiária, alternativa
## 5. Riscos Envolvidos
- Riscos identificados e mitigação
## 6. Vantagens e Desvantagens
## 7. Recomendação Final

REGRAS:
- NÃO garanta resultado
- Use termos qualitativos (alto/médio/baixo)
- Indique limitações quando dados forem insuficientes
- Fundamente juridicamente cada recomendação`;

    const userPrompt = `Processo: ${JSON.stringify({
      title: process.title,
      number: process.number,
      type: process.type,
      status: process.status,
      legal_area: process.legal_area,
      description: process.description,
      priority: process.priority,
    })}

Riscos ativos: ${JSON.stringify(risks || [])}
Precedentes internos: ${JSON.stringify(precedents || [])}`;

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
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns minutos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("Erro no gateway de IA");
    }

    const aiData = await response.json();
    const strategy = aiData.choices?.[0]?.message?.content || "Não foi possível gerar a estratégia.";

    return new Response(JSON.stringify({ strategy }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-legal-strategy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
