import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth, requireOrgMember } from "../_shared/auth.ts";
import { hfChat, getHfModel, requireHfToken } from "../_shared/huggingface.ts";

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

  draft_contract: `Você é um redator jurídico sênior especializado em minutas contratuais. Gere um contrato completo, estruturado, contextualizado e internamente consistente com base nos dados fornecidos.

## ESTRUTURA OBRIGATÓRIA DO CONTRATO (12 seções):

### CLÁUSULA 1ª — IDENTIFICAÇÃO DAS PARTES
- Dados completos de cada parte (nome/razão social, CNPJ/CPF, endereço, representante legal)
- Poderes de representação
- Qualificação jurídica

### CLÁUSULA 2ª — OBJETO
- Descrição clara e detalhada do objeto
- Escopo dos serviços/fornecimento
- Limitações expressas
- Entregáveis (quando aplicável)

### CLÁUSULA 3ª — OBRIGAÇÕES DAS PARTES
- Obrigações principais de cada parte
- Obrigações acessórias
- Obrigações regulatórias específicas do setor
- Obrigações de compliance e integridade

### CLÁUSULA 4ª — PREÇO E CONDIÇÕES FINANCEIRAS
- Valor do contrato (usar dados fornecidos)
- Forma e condições de pagamento
- Índice de reajuste (IPCA, IGP-M, etc.)
- Multas e penalidades por inadimplemento
- Impostos e encargos

### CLÁUSULA 5ª — PRAZOS
- Vigência do contrato
- Condições de renovação (automática ou não)
- Prazos de rescisão e notificação prévia
- Prazos regulatórios aplicáveis
- Cronograma de entregas (quando aplicável)

### CLÁUSULA 6ª — GARANTIAS
- Garantias financeiras (caução, fiança, seguro)
- Garantias operacionais e de qualidade
- Garantias regulatórias
- Condições de execução e liberação

### CLÁUSULA 7ª — RESPONSABILIDADE E LIMITAÇÃO
- Limites de responsabilidade (cap financeiro)
- Exclusões de responsabilidade
- Exceções às limitações
- Alinhamento com CDC (se aplicável) e LGPD
- Responsabilidade solidária vs. subsidiária

### CLÁUSULA 8ª — PROTEÇÃO DE DADOS (LGPD)
(Incluir SOMENTE se solicitado ou se o tipo de contrato exigir)
- Bases legais para tratamento de dados
- Finalidades específicas
- Prazo de retenção
- Compartilhamento com terceiros
- Transferência internacional de dados
- Direitos dos titulares
- Medidas de segurança técnicas e administrativas
- Designação de Encarregado (DPO)

### CLÁUSULA 9ª — CONFIDENCIALIDADE
- Definição de informação confidencial
- Escopo e abrangência
- Exceções (informação pública, ordem judicial, etc.)
- Prazo pós-contratual de confidencialidade
- Penalidades por violação

### CLÁUSULA 10ª — COMPLIANCE E INTEGRIDADE
- Cláusula anticorrupção (Lei 12.846/2013)
- Declaração de integridade
- Obrigações regulatórias específicas do setor
- Direito de auditoria
- Código de conduta aplicável

### CLÁUSULA 11ª — FORO E RESOLUÇÃO DE CONFLITOS
- Foro competente (usar jurisdição fornecida ou inferir)
- Cláusula de arbitragem (se solicitado): câmara, regras, idioma, sede
- Mediação prévia obrigatória (quando aplicável)
- Lei aplicável

### CLÁUSULA 12ª — DISPOSIÇÕES GERAIS E ANEXOS
- Comunicações entre as partes
- Cessão e sub-contratação
- Independência das cláusulas (severability)
- Integralidade do acordo
- Assinaturas e testemunhas
- Lista de anexos (se solicitado): técnicos, financeiros, regulatórios

---

## REGRAS DE REDAÇÃO:
1. **Consistência interna**: Verifique que obrigações, prazos e valores estão alinhados entre todas as cláusulas. Não pode haver conflitos entre seções.
2. **Cláusulas proibidas**: NÃO inclua cláusulas que violem CDC, LGPD, CLT ou Código Civil. Se detectar risco, substitua por alternativa legal.
3. **Adaptação ao setor**: Adapte linguagem, cláusulas regulatórias e garantias ao setor econômico informado.
4. **Nível de risco**: Ajuste limites de responsabilidade, garantias e penalidades conforme o nível de risco (conservador = mais proteção, agressivo = mais flexibilidade).
5. **Formalidade**: Ajuste o tom da linguagem conforme solicitado (formal = juridiquês completo, simplificado = linguagem acessível).
6. **Complexidade**: Executivo = resumido e direto; Técnico = detalhado com cláusulas específicas.

## SEÇÃO FINAL OBRIGATÓRIA:
### ⚠️ PONTOS DE ATENÇÃO PARA REVISÃO HUMANA
Liste todos os pontos que exigem validação por advogado humano:
- Valores e índices a confirmar
- Dados das partes a completar
- Cláusulas que dependem de informação adicional
- Riscos regulatórios específicos a validar
- Aspectos setoriais que exigem parecer especializado

IMPORTANTE: Este é um RASCUNHO JURÍDICO que requer REVISÃO HUMANA OBRIGATÓRIA antes de uso. A IA não emite parecer jurídico conclusivo e não substitui a análise de um advogado.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;

    const { contract_id, organization_id, analysis_type, extra_context, user_id } = await req.json();

    if (!organization_id || !analysis_type) {
      return new Response(JSON.stringify({ error: "organization_id e analysis_type são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const memberError = await requireOrgMember(auth.supabase, auth.userId, organization_id);
    if (memberError) return memberError;

    const systemPrompt = SYSTEM_PROMPTS[analysis_type];
    if (!systemPrompt) {
      return new Response(JSON.stringify({ error: `analysis_type inválido: ${analysis_type}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = auth.supabase;

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

    // For draft_contract, fetch additional context: similar contracts, templates, compliance policies
    if (analysis_type === "draft_contract") {
      // Fetch similar contracts from same org for reference
      const { data: similarContracts } = await supabase
        .from("contracts")
        .select("title, contract_type, clauses, terms, description, amount_cents, currency, tags")
        .eq("organization_id", organization_id)
        .neq("id", contract_id || "00000000-0000-0000-0000-000000000000")
        .limit(5);

      if (similarContracts?.length) {
        contractContext += `\n\n## Contratos Similares da Organização (referência)`;
        for (const sc of similarContracts) {
          contractContext += `\n- **${sc.title}** (${sc.contract_type}): ${sc.description?.slice(0, 200) || "sem descrição"}`;
          if (sc.clauses) contractContext += `\n  Cláusulas-modelo: ${sc.clauses.slice(0, 500)}`;
        }
      }

      // Fetch document templates tagged as contract models
      const { data: templates } = await supabase
        .from("ai_templates")
        .select("title, content, template_type, tags")
        .eq("organization_id", organization_id)
        .eq("is_active", true)
        .in("template_type", ["contract", "contract_model", "minuta"])
        .limit(3);

      if (templates?.length) {
        contractContext += `\n\n## Modelos Internos de Contrato`;
        for (const t of templates) {
          contractContext += `\n### ${t.title}\n${t.content.slice(0, 1000)}`;
        }
      }

      // Fetch compliance policies
      const { data: policies } = await supabase
        .from("compliance_policies")
        .select("title, content, policy_type")
        .eq("organization_id", organization_id)
        .eq("is_active", true)
        .limit(3);

      if (policies?.length) {
        contractContext += `\n\n## Políticas de Compliance Aplicáveis`;
        for (const p of policies) {
          contractContext += `\n### ${p.title} (${p.policy_type})\n${p.content.slice(0, 500)}`;
        }
      }
    }

    if (extra_context) {
      contractContext += `\n\n## Contexto Adicional / Parâmetros do Usuário\n${extra_context}`;
    }

    requireHfToken();

    const aiResponse = await hfChat({
        model: getHfModel(),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contractContext || "Gere um contrato com base no contexto adicional fornecido." },
        ],
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

    // Map analysis_type to audit actions
    const auditActions: Record<string, string[]> = {
      full_analysis: ["contract_analyzed"],
      clause_analysis: ["contract_clause_classified", "contract_clause_selected"],
      renegotiation: ["contract_renegotiation_suggested"],
      benchmarking: ["contract_benchmark_performed"],
      abusive_detection: ["abusive_clause_detected"],
      draft_contract: ["contract_generated", "contract_consistency_checked", "contract_compliance_checked", "contract_model_used"],
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

    // Audit logs — multiple actions for draft_contract
    const actions = auditActions[analysis_type] || ["contract_analyzed"];
    const auditInserts = actions.map(action => ({
      action,
      user_id: user_id || null,
      resource_type: "contract",
      resource_id: predictionId || contract_id || null,
      organization_id,
      metadata: { analysis_type, contract_id },
    }));

    await supabase.from("audit_logs").insert(auditInserts as any);

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
