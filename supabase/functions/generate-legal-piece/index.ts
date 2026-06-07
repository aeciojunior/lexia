import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hfChat, requireHfToken } from "../_shared/huggingface.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PIECE_TYPE_LABELS: Record<string, string> = {
  peticao_inicial: "Petição Inicial",
  contestacao: "Contestação",
  recurso: "Recurso",
  contrato: "Contrato",
  parecer: "Parecer",
  minuta: "Minuta",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { piece_type, instructions, process_context } = await req.json();

    if (!instructions || !piece_type) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pieceLabel = PIECE_TYPE_LABELS[piece_type] || piece_type;

    let contextBlock = "";
    if (process_context) {
      contextBlock = `
CONTEXTO DO PROCESSO:
- Título: ${process_context.title || "N/A"}
- Número: ${process_context.number || "N/A"}
- Cliente: ${process_context.client_name || "N/A"}
`;
    }

    const systemPrompt = `Você é um assistente jurídico especializado em Direito Brasileiro. Sua função é gerar peças jurídicas profissionais, bem estruturadas e fundamentadas.

REGRAS:
- Gere APENAS a peça jurídica solicitada
- Use linguagem jurídica formal e apropriada
- Estruture o documento com cabeçalho, corpo e conclusão adequados
- Inclua fundamentação legal quando pertinente
- Use formatação Markdown para estruturar o documento
- NÃO invente números de processo, nomes de juízes ou dados que não foram fornecidos
- Se dados estiverem faltando, indique com [INSERIR DADO]`;

    const userPrompt = `Gere uma ${pieceLabel} com base nas seguintes instruções:

${contextBlock}

INSTRUÇÕES DO USUÁRIO:
${instructions}`;

    requireHfToken();

    const response = await hfChat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("HF error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "Nenhum conteúdo gerado.";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-legal-piece error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
