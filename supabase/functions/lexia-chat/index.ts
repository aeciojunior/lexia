import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const IA_PERMISSIONS: Record<string, string[]> = {
  chat: ["USE_IA_BASIC"],
  generate_petition: ["USE_IA_ADVANCED", "VIEW_PROCESSES", "VIEW_DOCUMENTS"],
  summarize_document: ["USE_IA_BASIC", "VIEW_DOCUMENTS"],
  compare_documents: ["USE_IA_ADVANCED", "VIEW_DOCUMENTS"],
};

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: [
    "MANAGE_ORGANIZATION", "DELETE_ORGANIZATION", "MANAGE_USERS", "VIEW_USERS",
    "MANAGE_PROCESSES", "VIEW_PROCESSES", "MANAGE_DOCUMENTS", "VIEW_DOCUMENTS",
    "MANAGE_TASKS", "VIEW_TASKS", "USE_IA_ADVANCED", "USE_IA_BASIC",
    "MANAGE_AUTOMATIONS", "VIEW_AUTOMATIONS", "MANAGE_AGENTS", "USE_AGENTS",
    "VIEW_FINANCIAL", "MANAGE_FINANCIAL", "VIEW_AUDIT_LOGS", "ACCESS_CLIENT_PORTAL",
  ],
  admin: [
    "MANAGE_USERS", "VIEW_USERS", "MANAGE_PROCESSES", "VIEW_PROCESSES",
    "MANAGE_DOCUMENTS", "VIEW_DOCUMENTS", "MANAGE_TASKS", "VIEW_TASKS",
    "USE_IA_ADVANCED", "USE_IA_BASIC", "MANAGE_AUTOMATIONS", "VIEW_AUTOMATIONS",
    "MANAGE_AGENTS", "USE_AGENTS", "VIEW_FINANCIAL", "VIEW_AUDIT_LOGS", "ACCESS_CLIENT_PORTAL",
  ],
  user: [
    "MANAGE_PROCESSES", "VIEW_PROCESSES", "MANAGE_DOCUMENTS", "VIEW_DOCUMENTS",
    "MANAGE_TASKS", "VIEW_TASKS", "USE_IA_ADVANCED", "USE_IA_BASIC", "USE_AGENTS", "ACCESS_CLIENT_PORTAL",
  ],
  intern: ["VIEW_PROCESSES", "VIEW_DOCUMENTS", "MANAGE_TASKS", "VIEW_TASKS", "USE_IA_BASIC", "ACCESS_CLIENT_PORTAL"],
  client: ["VIEW_PROCESSES", "VIEW_DOCUMENTS", "ACCESS_CLIENT_PORTAL"],
};

function hasPermissions(role: string, requiredPerms: string[]): boolean {
  const perms = ROLE_PERMISSIONS[role] || [];
  return requiredPerms.every((p) => perms.includes(p));
}

// --- Intent Detection ---
interface DetectedIntent {
  type: string;
  keywords: string[];
}

function detectIntent(text: string): DetectedIntent {
  const lower = text.toLowerCase();
  const intents: { type: string; patterns: string[] }[] = [
    { type: "deadlines", patterns: ["prazo", "vencimento", "audiência", "audiencia", "data limite", "prazos"] },
    { type: "risk", patterns: ["risco", "riscos", "perigo", "ameaça", "vulnerabilidade", "fraqueza", "fraco"] },
    { type: "movements", patterns: ["movimentação", "movimentacao", "movimentações", "despacho", "decisão judicial", "publicação", "intimação"] },
    { type: "documents", patterns: ["documento", "contrato", "laudo", "petição", "peça", "certidão", "anexo", "cláusula"] },
    { type: "calculations", patterns: ["valor", "cálculo", "calculo", "dívida", "divida", "parcela", "juros", "correção", "honorário", "multa", "montante"] },
    { type: "jurisprudence", patterns: ["jurisprudência", "jurisprudencia", "súmula", "sumula", "precedente", "stj", "stf", "tjsp", "tribunal", "entendimento"] },
    { type: "clients", patterns: ["cliente", "parte", "autor", "réu", "reu", "requerente", "requerido"] },
    { type: "history", patterns: ["histórico", "historico", "aconteceu", "última decisão", "ultimo", "cronologia", "linha do tempo"] },
  ];

  const matched: string[] = [];
  let bestType = "general";

  for (const intent of intents) {
    for (const pattern of intent.patterns) {
      if (lower.includes(pattern)) {
        matched.push(pattern);
        if (bestType === "general") bestType = intent.type;
      }
    }
  }

  return { type: bestType, keywords: matched };
}

// --- Context Fetching ---
async function fetchContext(
  supabase: any,
  orgId: string,
  intent: DetectedIntent,
  processId?: string,
  documentId?: string,
  clientId?: string
): Promise<{ context: string; sources: any[] }> {
  const sources: any[] = [];
  const sections: string[] = [];
  const MAX_CONTEXT = 4000;

  try {
    // Always fetch glossary
    const { data: glossary } = await supabase
      .from("legal_glossary")
      .select("term, preferred_term")
      .eq("organization_id", orgId)
      .limit(100);
    if (glossary?.length) {
      sources.push({ type: "glossary", count: glossary.length });
    }

    // Process context
    if (processId) {
      const { data: process } = await supabase
        .from("processes")
        .select("id, title, process_number, status, court, risk_level, legal_area, phase, case_value, description, parties")
        .eq("id", processId)
        .eq("organization_id", orgId)
        .single();

      if (process) {
        sections.push(`## Processo Selecionado\n- Título: ${process.title}\n- Número: ${process.process_number || "N/A"}\n- Status: ${process.status}\n- Tribunal: ${process.court || "N/A"}\n- Risco: ${process.risk_level || "N/A"}\n- Área: ${process.legal_area || "N/A"}\n- Fase: ${process.phase || "N/A"}\n- Valor da causa: ${process.case_value || "N/A"}\n- Descrição: ${(process.description || "").substring(0, 500)}\n- Partes: ${JSON.stringify(process.parties || []).substring(0, 500)}`);
        sources.push({ type: "process", id: processId, title: process.title });

        // Deadlines for this process
        if (["deadlines", "general", "history"].includes(intent.type)) {
          const { data: deadlines } = await supabase
            .from("deadlines")
            .select("title, due_date, status, priority")
            .eq("process_id", processId)
            .eq("organization_id", orgId)
            .order("due_date", { ascending: true })
            .limit(20);
          if (deadlines?.length) {
            sections.push(`## Prazos do Processo\n${deadlines.map((d: any) => `- ${d.title}: ${d.due_date} (${d.status}, prioridade: ${d.priority})`).join("\n")}`);
            sources.push({ type: "deadlines", count: deadlines.length });
          }
        }

        // Documents for this process
        if (["documents", "general", "risk"].includes(intent.type)) {
          const { data: docs } = await supabase
            .from("documents")
            .select("id, name, category, status, document_type, created_at")
            .eq("process_id", processId)
            .eq("organization_id", orgId)
            .limit(30);
          if (docs?.length) {
            sections.push(`## Documentos do Processo\n${docs.map((d: any) => `- ${d.name} (${d.category || d.document_type || "N/A"}, status: ${d.status})`).join("\n")}`);
            sources.push({ type: "documents", count: docs.length });
          }
        }

        // Movements
        if (["movements", "history", "general"].includes(intent.type)) {
          const { data: movements } = await supabase
            .from("process_events")
            .select("description, event_date, event_type")
            .eq("process_id", processId)
            .eq("organization_id", orgId)
            .order("event_date", { ascending: false })
            .limit(20);
          if (movements?.length) {
            sections.push(`## Movimentações Recentes\n${movements.map((m: any) => `- [${m.event_date}] (${m.event_type}): ${(m.description || "").substring(0, 200)}`).join("\n")}`);
            sources.push({ type: "movements", count: movements.length });
          }
        }

        // Decision extractions
        if (["risk", "history", "general"].includes(intent.type)) {
          const { data: decisions } = await supabase
            .from("decision_extractions")
            .select("decision_type, result, dispositivo, confidence, fundamentals")
            .eq("process_id", processId)
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false })
            .limit(5);
          if (decisions?.length) {
            sections.push(`## Decisões Extraídas\n${decisions.map((d: any) => `- Tipo: ${d.decision_type}, Resultado: ${d.result || "N/A"}, Confiança: ${d.confidence || "N/A"}%\n  Dispositivo: ${(d.dispositivo || "").substring(0, 300)}`).join("\n")}`);
            sources.push({ type: "decisions", count: decisions.length });
          }
        }
      }
    }

    // Document-specific context
    if (documentId) {
      const { data: doc } = await supabase
        .from("documents")
        .select("id, name, category, status, document_type, content, description")
        .eq("id", documentId)
        .eq("organization_id", orgId)
        .single();
      if (doc) {
        sections.push(`## Documento Selecionado\n- Nome: ${doc.name}\n- Categoria: ${doc.category || "N/A"}\n- Tipo: ${doc.document_type || "N/A"}\n- Status: ${doc.status}\n- Conteúdo: ${(doc.content || doc.description || "Sem conteúdo textual disponível").substring(0, 1500)}`);
        sources.push({ type: "document", id: documentId, name: doc.name });
      }
    }

    // Client context
    if (clientId) {
      const { data: client } = await supabase
        .from("clients")
        .select("full_name, email, phone, document_number, client_type, status, business_area, tags")
        .eq("id", clientId)
        .eq("organization_id", orgId)
        .single();
      if (client) {
        sections.push(`## Cliente\n- Nome: ${client.full_name}\n- Email: ${client.email || "N/A"}\n- Telefone: ${client.phone || "N/A"}\n- Documento: ${client.document_number || "N/A"}\n- Tipo: ${client.client_type}\n- Status: ${client.status}`);
        sources.push({ type: "client", id: clientId, name: client.full_name });
      }
    }

    // General queries without specific context - fetch summary stats
    if (!processId && !documentId && !clientId && intent.type === "deadlines") {
      const { data: upcomingDeadlines } = await supabase
        .from("deadlines")
        .select("title, due_date, status, priority")
        .eq("organization_id", orgId)
        .eq("status", "pending")
        .order("due_date", { ascending: true })
        .limit(15);
      if (upcomingDeadlines?.length) {
        sections.push(`## Prazos Pendentes da Organização\n${upcomingDeadlines.map((d: any) => `- ${d.title}: ${d.due_date} (prioridade: ${d.priority})`).join("\n")}`);
        sources.push({ type: "deadlines", count: upcomingDeadlines.length });
      }
    }

    // Glossary injection
    if (glossary?.length) {
      sections.push(`## Glossário Jurídico (use estes termos)\n${glossary.map((g: any) => `- "${g.term}" → "${g.preferred_term}"`).join("\n")}`);
    }

    let context = sections.join("\n\n");
    if (context.length > MAX_CONTEXT) {
      context = context.substring(0, MAX_CONTEXT) + "\n\n[... contexto truncado por limite de tokens]";
    }

    return { context, sources };
  } catch (err) {
    console.error("Context fetch error:", err);
    return { context: "", sources: [] };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado. Faça login para usar a IA." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // User-scoped client for auth
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service client for data fetching (bypasses RLS for context)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido ou expirado." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const userId = user.id;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.active_organization_id) {
      return new Response(
        JSON.stringify({ error: "Nenhuma organização ativa encontrada." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    const orgId = profile.active_organization_id;

    const { data: membership } = await supabaseAdmin
      .from("user_organizations")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .single();

    const userRole = membership?.role || "user";

    const { messages, operation = "chat", processId, documentId, clientId, conversationId } = await req.json();

    const requiredPerms = IA_PERMISSIONS[operation] || IA_PERMISSIONS.chat;
    if (!hasPermissions(userRole, requiredPerms)) {
      const roleLabel = userRole === "intern" ? "Estagiário" : userRole === "client" ? "Cliente" : userRole;

      // Audit denied query
      await supabaseAdmin.from("audit_logs").insert({
        action: "nl_query_denied_permission",
        user_id: userId,
        organization_id: orgId,
        resource_type: "nl_query",
        metadata: { role: userRole, operation, question: messages?.[messages.length - 1]?.content || "" },
      });

      return new Response(
        JSON.stringify({
          content: `⚠️ **Acesso negado.** Seu perfil (${roleLabel}) não tem permissão para esta operação de IA. Contate um administrador para obter acesso.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ content: "Serviço de IA não configurado." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // --- Intent Detection & Context Pipeline ---
    const lastUserMessage = messages?.[messages.length - 1]?.content || "";
    const intent = detectIntent(lastUserMessage);
    const { context: dataContext, sources } = await fetchContext(
      supabaseAdmin, orgId, intent, processId, documentId, clientId
    );

    // Build system prompt
    const roleContext = userRole === "intern"
      ? "\n\nIMPORTANTE: O usuário é estagiário. Não forneça informações sobre dados financeiros, automações ou configurações avançadas."
      : userRole === "client"
        ? "\n\nIMPORTANTE: O usuário é cliente externo. Responda apenas sobre processos e documentos do próprio cliente."
        : "";

    const contextSection = dataContext
      ? `\n\n--- DADOS REAIS DA ORGANIZAÇÃO (use como base para responder) ---\n${dataContext}\n--- FIM DOS DADOS ---`
      : "";

    const systemPrompt = `Você é o LexIA, um assistente jurídico inteligente brasileiro. Você ajuda advogados com:
- Análise de processos judiciais
- Geração de peças jurídicas (petições, contestações, recursos)
- Consulta de jurisprudência e legislação brasileira
- Cálculo de prazos processuais
- Análise de risco processual
- Explicação de artigos de lei

REGRAS OBRIGATÓRIAS:
1. Responda sempre em português brasileiro, de forma clara, profissional e precisa.
2. Use formatação markdown quando apropriado.
3. NUNCA invente dados. Se uma informação não está nos dados fornecidos, diga claramente "Não encontrei essa informação nos dados disponíveis."
4. Sempre cite as fontes internas usadas (ex: "Conforme o documento X", "De acordo com a movimentação de DD/MM/AAAA").
5. Para análise de risco, use termos qualitativos (risco alto, moderado, baixo). NUNCA preveja resultados de processos.
6. Quando dados são insuficientes, indique quais informações adicionais seriam necessárias.
7. Cite artigos de lei e jurisprudência quando relevante.
8. Para cálculos/valores, explique a metodologia e os índices aplicados. Nunca invente valores.${roleContext}${contextSection}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text();
      console.error("AI Gateway error:", status, errorText);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos ao workspace." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 }
        );
      }

      return new Response(
        JSON.stringify({ content: "Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Sem resposta.";

    // --- Persist to nl_queries & audit_logs ---
    const queryType = intent.type;

    await Promise.all([
      supabaseAdmin.from("nl_queries").insert({
        organization_id: orgId,
        user_id: userId,
        conversation_id: conversationId || "unknown",
        question: lastUserMessage,
        answer: content.substring(0, 10000),
        sources_used: sources,
        query_type: queryType,
        status: "answered",
      }),
      supabaseAdmin.from("audit_logs").insert({
        action: `nl_query_answered`,
        user_id: userId,
        organization_id: orgId,
        resource_type: "nl_query",
        metadata: {
          query_type: queryType,
          intent_keywords: intent.keywords,
          sources_count: sources.length,
          process_id: processId || null,
          document_id: documentId || null,
          question_preview: lastUserMessage.substring(0, 200),
        },
      }),
      sources.length > 0
        ? supabaseAdmin.from("audit_logs").insert({
            action: "nl_query_source_used",
            user_id: userId,
            organization_id: orgId,
            resource_type: "nl_query",
            metadata: { sources, query_type: queryType },
          })
        : Promise.resolve(),
    ]);

    return new Response(
      JSON.stringify({ content, sources, queryType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ content: "Erro interno. Tente novamente." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
