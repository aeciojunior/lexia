import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hfChat, requireHfToken } from "../_shared/huggingface.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { images, organizationId } = await req.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "Envie ao menos uma imagem (base64)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!organizationId) {
      return new Response(JSON.stringify({ error: "organizationId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify org membership
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isMember } = await supabase.rpc("is_org_member", {
      _user_id: userId,
      _org_id: organizationId,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Sem acesso à organização" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const HUGGINGFACE_API_KEY = Deno.env.get("HUGGINGFACE_API_KEY");
    if (!HUGGINGFACE_API_KEY) throw new Error("HUGGINGFACE_API_KEY não configurada");

    // Build multimodal content: send all page images to Gemini for OCR
    const userContent: any[] = [
      {
        type: "text",
        text: "Extraia TODO o texto deste documento PDF digitalizado. Mantenha a estrutura original: parágrafos, títulos, numeração, tabelas. Se houver trechos ilegíveis, indique com [ilegível]. Retorne APENAS o texto extraído, sem comentários adicionais.",
      },
    ];

    for (const img of images.slice(0, 20)) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: img.startsWith("data:") ? img : `data:image/png;base64,${img}`,
        },
      });
    }

    const aiResponse = await hfChat({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Você é um sistema de OCR avançado para documentos jurídicos brasileiros. Extraia o texto com máxima fidelidade, preservando estrutura, formatação e pontuação.",
          },
          {
            role: "user",
            content: userContent,
          },
        ],
      });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI OCR error:", status, errText);
      throw new Error("Erro no OCR via IA");
    }

    const aiData = await aiResponse.json();
    const extractedText = aiData.choices?.[0]?.message?.content || "";

    // Audit log
    await supabase.from("audit_logs").insert({
      action: "pdf_ocr_executed",
      user_id: userId,
      organization_id: organizationId,
      resource_type: "text_comparison",
      metadata: {
        pages_processed: Math.min(images.length, 20),
        text_length: extractedText.length,
      },
    });

    return new Response(JSON.stringify({ text: extractedText, pages: Math.min(images.length, 20) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-pdf-text error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
