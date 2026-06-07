import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth, requireOrgMember } from "../_shared/auth.ts";
import { hfChat, getHfModel, requireHfToken } from "../_shared/huggingface.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type PredictionType = "time_estimation" | "success_probability" | "settlement_recommendation";

const SYSTEM_PROMPTS: Record<PredictionType, string> = {
  time_estimation: `Você é um analista jurídico sênior do sistema LexIA especializado em estimativa de tempo processual.

Gere uma análise qualitativa do tempo de tramitação do processo, em Markdown, com as seguintes seções:

## 1. Fase Atual
## 2. Estimativa de Tempo
- Use APENAS termos qualitativos: **curto prazo**, **médio prazo** ou **longo prazo**
- Justifique com base no contexto
## 3. Fatores que Aceleram
## 4. Fatores que Atrasam
## 5. Riscos de Demora
## 6. Recomendações Estratégicas

REGRAS ABSOLUTAS:
- NUNCA forneça datas exatas, números de dias/meses/anos ou percentuais
- Use SOMENTE termos qualitativos (curto/médio/longo prazo)
- Indique limitações quando dados forem insuficientes
- Considere: complexidade, volume probatório, congestionamento da vara, recursos pendentes, perícias
- Fundamente cada conclusão`,

  success_probability: `Você é um analista jurídico sênior do sistema LexIA especializado em avaliação de probabilidade de êxito.

Gere uma análise qualitativa da probabilidade de êxito do processo, em Markdown, com as seguintes seções:

## 1. Probabilidade de Êxito
- Use APENAS: **Alta**, **Moderada** ou **Baixa**
## 2. Justificativa Jurídica
## 3. Fatores Favoráveis
## 4. Fatores Desfavoráveis
## 5. Riscos Associados
## 6. Recomendações Estratégicas

REGRAS ABSOLUTAS:
- NUNCA forneça percentuais ou probabilidades numéricas
- Use SOMENTE termos qualitativos (alta/moderada/baixa)
- Indique limitações quando dados forem insuficientes
- Considere: força da tese, qualidade das provas, jurisprudência, comportamento do tribunal, súmulas
- Fundamente cada conclusão`,

  settlement_recommendation: `Você é um analista jurídico sênior do sistema LexIA especializado em recomendação de acordos.

Gere uma análise qualitativa sobre a viabilidade de acordo para o processo, em Markdown, com as seguintes seções:

## 1. Recomendação
- Use APENAS: **Favorável ao acordo**, **Neutra** ou **Desfavorável ao acordo**
## 2. Justificativa Jurídica e Financeira
## 3. Riscos Mitigados pelo Acordo
## 4. Riscos Mantidos sem Acordo
## 5. Vantagens e Desvantagens
## 6. Alternativas Estratégicas

REGRAS ABSOLUTAS:
- NUNCA sugira valores numéricos ou faixas monetárias
- Use SOMENTE termos qualitativos
- Indique limitações quando dados forem insuficientes
- Considere: custo de litigar, risco de condenação, tempo estimado, impacto reputacional, postura conciliatória do tribunal
- Fundamente cada conclusão`,
};

const AUDIT_ACTIONS: Record<PredictionType, string> = {
  time_estimation: "processing_time_estimated",
  success_probability: "success_probability_estimated",
  settlement_recommendation: "settlement_recommendation_generated",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;

    const { process_id, organization_id, prediction_type, user_id } = await req.json();

    if (!process_id || !organization_id || !prediction_type) {
      return new Response(JSON.stringify({ error: "process_id, organization_id and prediction_type required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["time_estimation", "success_probability", "settlement_recommendation"].includes(prediction_type)) {
      return new Response(JSON.stringify({ error: "Invalid prediction_type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const memberError = await requireOrgMember(auth.supabase, auth.userId, organization_id);
    if (memberError) return memberError;

    const supabase = auth.supabase;

    // Fetch process
    const { data: process } = await supabase.from("processes").select("*").eq("id", process_id).single();
    if (!process) {
      return new Response(JSON.stringify({ error: "Processo não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch risks & precedents in parallel
    const [risksRes, precedentsRes] = await Promise.all([
      supabase.from("risks").select("title, severity, category, description, mitigation")
        .eq("organization_id", organization_id).eq("status", "open").limit(10),
      supabase.from("internal_precedents").select("title, precedent_type, legal_area, result_obtained, recommendations, context")
        .eq("organization_id", organization_id).limit(5),
    ]);

    const HUGGINGFACE_API_KEY = Deno.env.get("HUGGINGFACE_API_KEY");
    if (!HUGGINGFACE_API_KEY) throw new Error("HUGGINGFACE_API_KEY not configured");

    const userPrompt = `Processo: ${JSON.stringify({
      title: process.title,
      number: process.number,
      type: process.type,
      status: process.status,
      classe: process.classe,
      fase: process.fase,
      description: process.description,
      court: process.court,
      judge: process.judge,
      vara: process.vara,
      risk_level: process.risk_level,
    })}

Riscos ativos: ${JSON.stringify(risksRes.data || [])}
Precedentes internos: ${JSON.stringify(precedentsRes.data || [])}`;

    const response = await hfChat({
        model: getHfModel(),
        messages: [
          { role: "system", content: SYSTEM_PROMPTS[prediction_type as PredictionType] },
          { role: "user", content: userPrompt },
        ],
      });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("Erro no gateway de IA");
    }

    const aiData = await response.json();
    const result = aiData.choices?.[0]?.message?.content || "Não foi possível gerar a análise.";

    // Persist to predictions table
    let predictionId: string | null = null;
    if (user_id) {
      const { data: predRow } = await supabase.from("predictions").insert({
        user_id,
        organization_id,
        prediction_type,
        target_type: "process",
        target_id: process_id,
        ai_explanation: result,
        status: "completed",
        generated_at: new Date().toISOString(),
        result: { markdown: result },
        input_data: {
          process_title: process.title,
          process_number: process.number,
          process_type: process.type,
        },
      }).select("id").single();
      predictionId = predRow?.id || null;

      // Audit log
      await supabase.from("audit_logs").insert({
        action: AUDIT_ACTIONS[prediction_type as PredictionType],
        user_id,
        organization_id,
        resource_type: "prediction",
        resource_id: predictionId || process_id,
        metadata: { prediction_type, process_id },
      });
    }

    return new Response(JSON.stringify({ result, prediction_id: predictionId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-predictions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
