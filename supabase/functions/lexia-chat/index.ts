import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// RBAC permission mapping for IA operations
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- RBAC Middleware: Authenticate and authorize ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado. Faça login para usar a IA." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Token inválido ou expirado." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const userId = claimsData.claims.sub;

    // Get user's active org and role
    const { data: profile } = await supabase
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

    // Get user's role in the org
    const { data: membership } = await supabase
      .from("user_organizations")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .single();

    const userRole = membership?.role || "user";

    // Parse request
    const { messages, operation = "chat" } = await req.json();

    // Check RBAC permissions for the requested operation
    const requiredPerms = IA_PERMISSIONS[operation] || IA_PERMISSIONS.chat;
    if (!hasPermissions(userRole, requiredPerms)) {
      const roleLabel = userRole === "intern" ? "Estagiário" : userRole === "client" ? "Cliente" : userRole;
      return new Response(
        JSON.stringify({
          content: `⚠️ **Acesso negado.** Seu perfil (${roleLabel}) não tem permissão para esta operação de IA. Contate um administrador para obter acesso.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // --- End RBAC Middleware ---

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ content: "Serviço de IA não configurado." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Build system prompt with role context
    const roleContext = userRole === "intern"
      ? "\n\nIMPORTANTE: O usuário é estagiário. Não forneça informações sobre dados financeiros, automações ou configurações avançadas. Limite respostas a consultas básicas, tarefas e jurisprudência."
      : userRole === "client"
        ? "\n\nIMPORTANTE: O usuário é cliente externo. Responda apenas sobre processos e documentos do próprio cliente. Não forneça informações internas do escritório, financeiras ou operacionais."
        : "";

    const systemPrompt = `Você é o LexIA, um assistente jurídico inteligente brasileiro. Você ajuda advogados com:
- Análise de processos judiciais
- Geração de peças jurídicas (petições, contestações, recursos)
- Consulta de jurisprudência e legislação brasileira
- Cálculo de prazos processuais
- Análise de risco processual
- Explicação de artigos de lei

Responda sempre em português brasileiro, de forma clara, profissional e precisa. Use formatação markdown quando apropriado. Cite artigos de lei e jurisprudência quando relevante.${roleContext}`;

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
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      return new Response(
        JSON.stringify({ content: "Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Sem resposta.";

    return new Response(
      JSON.stringify({ content }),
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
