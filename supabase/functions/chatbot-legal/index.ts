import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { conversationId, organizationId, message, userId } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get chatbot config
    const { data: config } = await supabase
      .from("chatbot_configs")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();

    // Get conversation history
    const { data: history } = await supabase
      .from("chatbot_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    // Build system prompt
    let systemPrompt = `Você é um assistente jurídico profissional chamado "${config?.name || "Assistente Jurídico"}".
Responda sempre em português brasileiro. Seja preciso, profissional e útil.
Tom: ${config?.tone || "professional"}.`;

    if (config?.system_prompt) {
      systemPrompt += `\n\nInstruções adicionais da organização:\n${config.system_prompt}`;
    }

    if (config?.can_open_tickets) {
      systemPrompt += `\n\nSe o usuário solicitar ajuda, suporte ou reportar um problema, informe que pode abrir um ticket de atendimento.`;
    }

    // Get some org context
    const [processesRes, deadlinesRes] = await Promise.all([
      config?.can_query_processes
        ? supabase.from("processes").select("id,title,status,process_number").eq("organization_id", organizationId).limit(10)
        : Promise.resolve({ data: [] }),
      supabase.from("deadlines").select("id,title,status,due_date").eq("organization_id", organizationId).eq("status", "pending").limit(5),
    ]);

    if (processesRes.data?.length) {
      systemPrompt += `\n\nProcessos ativos da organização (para referência):\n${processesRes.data.map((p: any) => `- ${p.process_number || ''} ${p.title} (${p.status})`).join("\n")}`;
    }

    if (deadlinesRes.data?.length) {
      systemPrompt += `\n\nPrazos pendentes:\n${deadlinesRes.data.map((d: any) => `- ${d.title} (vence: ${d.due_date})`).join("\n")}`;
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const endpoint = Deno.env.get("AZURE_OPENAI_ENDPOINT")!;
    const apiKey = Deno.env.get("AZURE_OPENAI_API_KEY")!;

    const aiResponse = await fetch(`${endpoint}/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-02-15-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({ messages, max_tokens: 1500, temperature: 0.7 }),
    });

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua solicitação.";

    // Save assistant message
    await supabase.from("chatbot_messages").insert({
      organization_id: organizationId,
      conversation_id: conversationId,
      role: "assistant",
      content: reply,
    });

    // Update conversation summary
    if ((history?.length || 0) <= 1) {
      const summary = message.substring(0, 100);
      await supabase.from("chatbot_conversations").update({ summary }).eq("id", conversationId);
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      action: "chatbot_interaction",
      user_id: userId,
      organization_id: organizationId,
      resource_type: "chatbot_conversation",
      resource_id: conversationId,
    });

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Chatbot error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
