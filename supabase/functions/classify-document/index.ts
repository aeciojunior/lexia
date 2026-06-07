import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { hfChat, getHfModel, requireHfToken } from "../_shared/huggingface.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { document_id, file_name, file_content } = await req.json();
    if (!document_id) {
      return new Response(JSON.stringify({ error: "document_id é obrigatório." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Fetch document
    const { data: doc, error: docError } = await supabaseUser
      .from("documents")
      .select("id, organization_id, file_name, category, notes")
      .eq("id", document_id)
      .single();

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: "Documento não encontrado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    const orgId = doc.organization_id;
    try {
      requireHfToken();
    } catch {
      return new Response(JSON.stringify({ error: "IA não configurada." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const docName = file_name || doc.file_name || "";
    const contentHint = file_content ? file_content.substring(0, 6000) : "";

    const systemPrompt = `Você é um especialista jurídico brasileiro em classificação de documentos. Analise o nome do arquivo, a categoria atual e o conteúdo (se disponível) para classificar o tipo do documento jurídico. Retorne APENAS a chamada da função.

Tipos válidos:
- peticao_inicial: Petição inicial, ação, propositura
- contestacao: Contestação, defesa
- replica: Réplica, impugnação à contestação
- recurso: Recurso, apelação, agravo, embargos
- provas: Documentos probatórios, fotos, laudos de prova
- decisao: Decisão interlocutória, despacho
- sentenca: Sentença
- acordao: Acórdão
- procuracao: Procuração, substabelecimento
- contrato: Contrato, aditivo contratual
- doc_pessoal: Documentos pessoais (RG, CPF, certidões)
- laudo_pericia: Laudo, perícia, parecer técnico
- comprovante: Comprovantes, recibos, notas fiscais
- correspondencia: Ofícios, notificações, cartas
- outro: Não classificável

Padrões linguísticos:
- "Excelentíssimo Senhor Doutor Juiz" → peticao_inicial
- "Apresenta contestação" → contestacao
- "Vistos etc." → sentenca
- "Acordam os desembargadores" → acordao
- "Procuração" no nome → procuracao
- "Laudo" ou "perícia" → laudo_pericia`;

    const userPrompt = `Classifique o documento:
Nome: ${docName}
Categoria atual: ${doc.category || "não definida"}
${doc.notes ? `Notas: ${doc.notes}` : ""}
${contentHint ? `\nConteúdo (trecho):\n${contentHint}` : ""}`;

    const aiResponse = await hfChat({
        model: getHfModel(),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_document",
              description: "Classifica um documento jurídico brasileiro por tipo.",
              parameters: {
                type: "object",
                properties: {
                  document_type: {
                    type: "string",
                    enum: ["peticao_inicial", "contestacao", "replica", "recurso", "provas", "decisao", "sentenca", "acordao", "procuracao", "contrato", "doc_pessoal", "laudo_pericia", "comprovante", "correspondencia", "outro"],
                    description: "Tipo do documento",
                  },
                  confidence: {
                    type: "number",
                    description: "Confiança da classificação de 0 a 1",
                  },
                  relevant_excerpts: {
                    type: "array",
                    items: { type: "string" },
                    description: "Trechos que justificam a classificação",
                  },
                  rules_activated: {
                    type: "array",
                    items: { type: "string" },
                    description: "Padrões ou regras linguísticas ativadas",
                  },
                  justification: {
                    type: "string",
                    description: "Explicação da classificação em português",
                  },
                },
                required: ["document_type", "confidence", "relevant_excerpts", "rules_activated", "justification"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_document" } },
      });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429,
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402,
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao classificar documento." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call:", JSON.stringify(aiData));
      return new Response(JSON.stringify({ error: "IA não retornou classificação válida." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
      });
    }

    const classification = JSON.parse(toolCall.function.arguments);

    const classData = {
      document_id,
      organization_id: orgId,
      document_type: classification.document_type,
      confidence: Math.min(1, Math.max(0, classification.confidence)),
      relevant_excerpts: classification.relevant_excerpts,
      rules_activated: classification.rules_activated,
      justification: classification.justification,
      origin: "automatica",
      classified_by: user.id,
    };

    // Upsert
    const { data: existing } = await supabaseAdmin
      .from("document_classifications")
      .select("id")
      .eq("document_id", document_id)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin.from("document_classifications").update(classData).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("document_classifications").insert(classData);
    }

    // Log
    await supabaseAdmin.from("document_classification_logs").insert({
      document_id,
      organization_id: orgId,
      document_type: classification.document_type,
      confidence: classification.confidence,
      origin: "automatica",
      user_id: user.id,
    });

    return new Response(JSON.stringify(classification), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("classify-document error:", error);
    return new Response(JSON.stringify({ error: "Erro interno ao classificar documento." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
