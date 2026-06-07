import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PIECE_TYPE_LABELS: Record<string, string> = {
  peticao_inicial: "Petição Inicial",
  contestacao: "Contestação",
  recurso: "Recurso",
  manifestacao: "Manifestação",
  memorial: "Memorial",
  contrato: "Contrato",
  parecer: "Parecer",
  notificacao_extrajudicial: "Notificação Extrajudicial",
  peca_administrativa: "Peça Administrativa",
  personalizada: "Peça Personalizada",
};

const STYLE_LABELS: Record<string, string> = {
  juridico_formal: "Jurídico Formal",
  executivo: "Executivo",
  tecnico: "Técnico",
  objetivo: "Objetivo",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader?.replace("Bearer ", "");
    if (!token) throw new Error("No auth token");
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const {
      organization_id,
      process_id,
      piece_type = "peticao_inicial",
      style = "juridico_formal",
      detail_level = "completo",
      instructions = "",
      template_content = "",
      rewrite_content = "",
      rewrite_instructions = "",
    } = body;

    if (!organization_id) throw new Error("organization_id is required");

    const { data: isMember } = await supabase.rpc("is_org_member", {
      _user_id: user.id,
      _org_id: organization_id,
    });
    if (!isMember) throw new Error("Sem acesso à organização");

    // Aggregate context
    let processContext = "";
    let clientContext = "";
    let documentsContext = "";
    let movementsContext = "";

    if (process_id) {
      const { data: proc } = await supabase
        .from("processes")
        .select("*")
        .eq("id", process_id)
        .eq("organization_id", organization_id)
        .maybeSingle();

      if (proc) {
        processContext = `
## Dados do Processo
- Número: ${proc.number || "N/A"}
- Título: ${proc.title || "N/A"}
- Classe: ${proc.class || "N/A"}
- Assunto: ${proc.subject || "N/A"}
- Vara/Tribunal: ${proc.court || "N/A"}
- Fase: ${proc.phase || "N/A"}
- Valor da Causa: ${proc.amount_cents ? `R$ ${(proc.amount_cents / 100).toFixed(2)}` : "N/A"}
- Parte Autora: ${proc.plaintiff || "N/A"}
- Parte Ré: ${proc.defendant || "N/A"}
- Status: ${proc.status || "N/A"}
- Observações: ${proc.notes || "N/A"}
`;

        // Client
        if (proc.client_id) {
          const { data: client } = await supabase
            .from("clients")
            .select("full_name, document_number, document_type, email, phone, address, client_type")
            .eq("id", proc.client_id)
            .maybeSingle();
          if (client) {
            clientContext = `
## Dados do Cliente
- Nome: ${client.full_name}
- Documento: ${client.document_type} ${client.document_number || "N/A"}
- Email: ${client.email || "N/A"}
- Telefone: ${client.phone || "N/A"}
- Endereço: ${client.address || "N/A"}
- Tipo: ${client.client_type}
`;
          }
        }

        // Documents
        const { data: docs } = await supabase
          .from("documents")
          .select("file_name, category, notes, origin")
          .eq("process_id", process_id)
          .eq("organization_id", organization_id)
          .limit(20);
        if (docs && docs.length > 0) {
          documentsContext = `
## Documentos Anexados
${docs.map((d: any) => `- ${d.file_name} (${d.category}) ${d.notes ? `— ${d.notes}` : ""}`).join("\n")}
`;
        }

        // Movements
        const { data: events } = await supabase
          .from("process_events")
          .select("title, description, event_date, event_type")
          .eq("process_id", process_id)
          .order("event_date", { ascending: false })
          .limit(15);
        if (events && events.length > 0) {
          movementsContext = `
## Movimentações Recentes
${events.map((e: any) => `- [${e.event_date}] ${e.title}${e.description ? `: ${e.description.substring(0, 200)}` : ""}`).join("\n")}
`;
        }
      }
    }

    const pieceLabel = PIECE_TYPE_LABELS[piece_type] || piece_type;
    const styleLabel = STYLE_LABELS[style] || style;

    const isRewrite = !!rewrite_content;

    let systemPrompt: string;

    if (isRewrite) {
      systemPrompt = `Você é um advogado experiente e redator jurídico do sistema LexIA.
Sua tarefa é REESCREVER a peça jurídica abaixo conforme as instruções do usuário.

REGRAS OBRIGATÓRIAS:
- Nunca invente fatos, dados ou valores que não estejam no texto original.
- Mantenha coerência jurídica e factual.
- Respeite o estilo solicitado: ${styleLabel}.
- Preserve citações e referências existentes.
- Gere a peça completa reescrita em Markdown.

## Peça Original
${rewrite_content}

## Instruções de Reescrita
${rewrite_instructions || "Reescreva com melhor qualidade e coerência."}
`;
    } else {
      systemPrompt = `Você é um advogado experiente e redator jurídico do sistema LexIA.
Sua tarefa é gerar uma ${pieceLabel} completa, coerente, juridicamente consistente e pronta para uso.

REGRAS OBRIGATÓRIAS:
- Use APENAS os dados fornecidos abaixo. NUNCA invente fatos, nomes, valores ou datas.
- Cite jurisprudências apenas se forem reais e verificáveis.
- Respeite o estilo de escrita: ${styleLabel}.
- Nível de detalhe: ${detail_level}.
- Estruture a peça com: qualificação das partes, narrativa dos fatos, fundamentos jurídicos, pedidos e fechamento.
- Gere em formato Markdown com seções claras.

${processContext}
${clientContext}
${documentsContext}
${movementsContext}

${template_content ? `## Template da Organização\n${template_content}\n` : ""}
${instructions ? `## Instruções Adicionais do Usuário\n${instructions}\n` : ""}
`;
    }

    const userMessage = isRewrite
      ? `Reescreva esta peça jurídica conforme as instruções acima.`
      : `Gere uma ${pieceLabel} completa para o processo descrito acima, no estilo ${styleLabel}, com nível de detalhe "${detail_level}".`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      action: isRewrite ? "draft_regenerated" : "draft_generated",
      user_id: user.id,
      organization_id,
      resource_type: "draft",
      resource_id: process_id || null,
      metadata: { piece_type, style, detail_level, process_id },
    });

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-draft error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
