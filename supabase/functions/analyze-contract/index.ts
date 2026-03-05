import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPTS: Record<string, string> = {
  full_analysis: `Você é um analista jurídico especializado em contratos. Realize uma análise completa do contrato fornecido, cobrindo:

## Estrutura obrigatória da resposta:
### 1. Resumo Executivo
- Principais riscos, obrigações e prazos críticos

### 2. Análise de Cláusulas
- Cláusulas críticas, sensíveis, de risco, LGPD, regulatórias, financeiras e de responsabilidade

### 3. Obrigações
- Da empresa, da contraparte, vencidas, futuras e de reporte

### 4. Prazos
- Vigência, renovação, rescisão, entrega e regulatórios

### 5. Riscos
- Jurídico, financeiro, regulatório, operacional e de litígio (classifique cada como Baixo/Médio/Alto/Crítico)

### 6. Impacto Legislativo
- Leis e normas regulatórias aplicáveis, obrigações novas, riscos introduzidos

### 7. Recomendações Estratégicas
- Ajustes contratuais, renegociação, mitigação de risco, adequação regulatória

IMPORTANTE: Não emita parecer jurídico conclusivo. Indique limitações. Todas as análises são qualitativas e orientativas.`,

  clause_analysis: `Você é um especialista em análise de cláusulas contratuais. Analise cada cláusula do contrato e classifique-a em uma das categorias:

- **Padrão** — alinhada ao modelo interno
- **Aceitável** — diferente, mas sem risco relevante
- **Divergente** — diferente e requer atenção
- **Crítica** — risco jurídico, financeiro ou regulatório
- **Proibida** — viola política interna ou norma regulatória

Para cada cláusula, forneça:
1. Classificação (com emoji: ✅ Padrão, ⚠️ Aceitável, 🔶 Divergente, 🔴 Crítica, ⛔ Proibida)
2. Justificativa
3. Riscos associados
4. Recomendação de ajuste (quando aplicável)
5. Comparação com melhores práticas

Tipos analisados: responsabilidade, garantia, multa, rescisão, confidencialidade, LGPD, regulatórias, financeiras, foro, renovação.

IMPORTANTE: Não altere cláusulas automaticamente. Indique limitações.`,

  renegotiation: `Você é um consultor especializado em renegociação contratual. Analise o contrato e identifique oportunidades de renegociação.

## Estrutura:
### 1. Gatilhos Detectados
- Alterações legislativas, riscos elevados, cláusulas de reajuste próximas, renovação automática, descumprimentos

### 2. Tipos de Renegociação Sugeridos
- Valores, prazos, garantias, responsabilidades, multas, cláusulas regulatórias, LGPD, financeiras

### 3. Para cada sugestão:
- Motivo da renegociação
- Cláusulas afetadas
- Riscos mitigados vs. mantidos
- Alternativas possíveis
- Justificativa jurídica e financeira
- Impacto operacional
- Recomendação final

### 4. Simulação de Cenários
- Cenário conservador, moderado e agressivo

IMPORTANTE: Sugira alternativas qualitativas. Não altere contrato automaticamente.`,

  benchmarking: `Você é um analista de benchmarking contratual setorial. Compare o contrato com padrões do setor econômico indicado.

## Estrutura:
### 1. Aderência ao Setor
- Classificação geral: Alta / Média / Baixa

### 2. Cláusulas Divergentes do Padrão
- Cláusulas abaixo ou acima do padrão de mercado

### 3. Cláusulas Ausentes
- Cláusulas comuns no setor que estão faltando

### 4. Cláusulas Excessivas
- Cláusulas incomuns para o setor

### 5. Riscos Setoriais Específicos
- Riscos regulatórios, financeiros e operacionais do setor

### 6. Recomendações de Adequação
- Ajustes para alinhar ao padrão setorial

Setores: energia, telecomunicações, saúde, financeiro, varejo, logística, tecnologia, indústria, agronegócio, transporte, setor público.

IMPORTANTE: Use dados agregados e anonimizados. Indique limitações.`,

  abusive_detection: `Você é um especialista em proteção contratual. Identifique cláusulas abusivas, ilegais ou desproporcionais com base em:

- **CDC** (Código de Defesa do Consumidor)
- **LGPD** (Lei Geral de Proteção de Dados)
- **CLT** (Consolidação das Leis do Trabalho)
- **Código Civil**
- **Normas regulatórias setoriais**

## Para cada cláusula problemática:
1. **Classificação**: Abusiva / Ilegal / Desproporcional (🔴 Grave / 🟡 Média / 🟢 Leve)
2. **Justificativa jurídica**
3. **Base legal violada** (artigo/lei específica)
4. **Riscos associados**
5. **Recomendação de correção**
6. **Alternativas possíveis**

### Tipos verificados:
**CDC**: renúncia de direitos, limitação indevida, cláusulas leoninas, multas desproporcionais
**LGPD**: tratamento sem base legal, compartilhamento indevido, retenção excessiva
**CLT**: renúncia a direitos indisponíveis, jornada irregular, exclusividade abusiva

IMPORTANTE: Não emita parecer conclusivo. Indique limitações.`,

  draft_contract: `Você é um redator jurídico especializado. Gere um contrato completo, estruturado e contextualizado com base nos dados fornecidos.

## Estrutura obrigatória do contrato:
1. **Identificação das Partes** — dados completos e poderes
2. **Objeto** — descrição clara, escopo e limitações
3. **Obrigações das Partes** — principais, acessórias, regulatórias, compliance
4. **Preço e Condições Financeiras** — valores, reajustes, índices, multas
5. **Prazos** — vigência, renovação, rescisão, regulatórios
6. **Garantias** — financeiras, operacionais, regulatórias
7. **Responsabilidade** — limites, exclusões, exceções (CDC/LGPD)
8. **LGPD** — bases legais, finalidades, retenção, compartilhamento
9. **Confidencialidade** — escopo, exceções, prazo pós-contratual
10. **Compliance** — anticorrupção, integridade, regulatório
11. **Foro e Resolução de Conflitos** — foro adequado, arbitragem
12. **Disposições Gerais**

Aplique cláusulas adequadas ao setor, tipo e risco. Garanta consistência interna. Bloqueie cláusulas proibidas.

IMPORTANTE: Este é um rascunho que requer revisão humana. Indique pontos que exigem atenção.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { contract_id, organization_id, analysis_type, extra_context, user_id } = await req.json();

    if (!organization_id || !analysis_type) {
      return new Response(JSON.stringify({ error: "organization_id e analysis_type são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = SYSTEM_PROMPTS[analysis_type];
    if (!systemPrompt) {
      return new Response(JSON.stringify({ error: `analysis_type inválido: ${analysis_type}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build context
    let contractContext = "";

    if (contract_id) {
      const { data: contract } = await supabase
        .from("contracts")
        .select("*")
        .eq("id", contract_id)
        .single();

      if (contract) {
        const { data: client } = contract.client_id
          ? await supabase.from("clients").select("full_name, email, document_number, client_type").eq("id", contract.client_id).single()
          : { data: null };

        contractContext = `
## Dados do Contrato
- **Título**: ${contract.title}
- **Tipo**: ${contract.contract_type}
- **Status**: ${contract.status}
- **Valor**: R$ ${(contract.amount_cents / 100).toFixed(2)}
- **Moeda**: ${contract.currency}
- **Periodicidade**: ${contract.periodicity || "N/A"}
- **Pagamento**: ${contract.payment_method || "N/A"}
- **Início**: ${contract.start_date || "N/A"}
- **Término**: ${contract.end_date || "N/A"}
${client ? `- **Cliente**: ${client.full_name} (${client.client_type}, Doc: ${client.document_number || "N/A"})` : ""}
${contract.description ? `\n## Descrição\n${contract.description}` : ""}
${contract.clauses ? `\n## Cláusulas\n${contract.clauses}` : "\n## Cláusulas\nNenhuma cláusula definida no sistema."}
${contract.terms ? `\n## Termos\n${contract.terms}` : ""}
${contract.notes ? `\n## Observações\n${contract.notes}` : ""}
${contract.tags?.length ? `\n## Tags: ${contract.tags.join(", ")}` : ""}`;
      }
    }

    if (extra_context) {
      contractContext += `\n\n## Contexto Adicional\n${extra_context}`;
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contractContext || "Gere um contrato com base no contexto adicional fornecido." },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const result = aiData.choices?.[0]?.message?.content || "Nenhum resultado gerado.";

    // Map analysis_type to audit action
    const auditActions: Record<string, string> = {
      full_analysis: "contract_analyzed",
      clause_analysis: "contract_clause_classified",
      renegotiation: "contract_renegotiation_suggested",
      benchmarking: "contract_benchmark_performed",
      abusive_detection: "abusive_clause_detected",
      draft_contract: "contract_generated",
    };

    // Save to predictions for history
    let predictionId: string | null = null;
    if (contract_id) {
      const { data: pred } = await supabase.from("predictions").insert({
        organization_id,
        target_type: "contract",
        target_id: contract_id,
        prediction_type: analysis_type,
        ai_explanation: result,
        user_id: user_id || null,
      } as any).select("id").single();
      predictionId = pred?.id || null;
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      action: auditActions[analysis_type] || "contract_analyzed",
      user_id: user_id || null,
      resource_type: "contract",
      resource_id: predictionId || contract_id || null,
      organization_id,
      metadata: { analysis_type, contract_id },
    } as any);

    return new Response(JSON.stringify({ result, prediction_id: predictionId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-contract error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
