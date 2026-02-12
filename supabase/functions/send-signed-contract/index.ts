import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { signature_id } = await req.json();
    if (!signature_id) {
      return new Response(JSON.stringify({ error: "signature_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch signature with contract info
    const { data: sig, error: sigError } = await supabase
      .from("contract_signatures")
      .select("*, contracts(title, description, amount_cents, status, organization_id, client_id, clients(full_name, email))")
      .eq("id", signature_id)
      .single();

    if (sigError || !sig) {
      return new Response(JSON.stringify({ error: "Signature not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contract = sig.contracts;
    const client = contract?.clients;
    const orgId = contract?.organization_id;

    // Get organization name
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();

    // Get org admin emails (owners and admins)
    const { data: adminMembers } = await supabase
      .from("user_organizations")
      .select("user_id, role")
      .eq("organization_id", orgId)
      .in("role", ["owner", "admin"]);

    const adminEmails: string[] = [];
    if (adminMembers?.length) {
      for (const member of adminMembers) {
        const { data: userData } = await supabase.auth.admin.getUserById(member.user_id);
        if (userData?.user?.email) {
          adminEmails.push(userData.user.email);
        }
      }
    }

    const contractTitle = contract?.title || "Contrato";
    const clientName = client?.full_name || "Cliente";
    const clientEmail = client?.email;
    const orgName = org?.name || "Escritório";
    const signedAt = new Date(sig.signed_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const formatCurrency = (cents: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: #e0e0ff; margin: 0; font-size: 20px;">📝 Contrato Assinado</h1>
          <p style="color: #a0a0c0; margin: 8px 0 0; font-size: 14px;">${orgName}</p>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #333; font-size: 15px; line-height: 1.6;">
            O contrato <strong>"${contractTitle}"</strong> foi assinado digitalmente por <strong>${clientName}</strong>.
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px 0; color: #888; font-size: 13px;">Contrato</td>
              <td style="padding: 8px 0; font-size: 13px; font-weight: 600;">${contractTitle}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888; font-size: 13px;">Cliente</td>
              <td style="padding: 8px 0; font-size: 13px;">${clientName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888; font-size: 13px;">Valor</td>
              <td style="padding: 8px 0; font-size: 13px;">${formatCurrency(contract?.amount_cents || 0)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888; font-size: 13px;">Assinado em</td>
              <td style="padding: 8px 0; font-size: 13px;">${signedAt}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888; font-size: 13px;">Termos aceitos</td>
              <td style="padding: 8px 0; font-size: 13px;">${sig.accepted_terms ? "✅ Sim" : "❌ Não"}</td>
            </tr>
          </table>
          <p style="color: #666; font-size: 12px; margin-top: 16px;">
            Este email foi enviado automaticamente pelo sistema Lexia.
          </p>
        </div>
      </div>
    `;

    const emailPromises: Promise<Response>[] = [];

    // Send to office admins
    if (adminEmails.length > 0) {
      emailPromises.push(
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Lexia <onboarding@resend.dev>",
            to: adminEmails,
            subject: `Contrato "${contractTitle}" assinado por ${clientName}`,
            html: htmlBody,
          }),
        })
      );
    }

    // Send to client
    if (clientEmail) {
      const clientHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #e0e0ff; margin: 0; font-size: 20px;">✅ Confirmação de Assinatura</h1>
            <p style="color: #a0a0c0; margin: 8px 0 0; font-size: 14px;">${orgName}</p>
          </div>
          <div style="background: #ffffff; padding: 24px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #333; font-size: 15px; line-height: 1.6;">
              Olá <strong>${clientName}</strong>, confirmamos que o contrato <strong>"${contractTitle}"</strong> foi assinado com sucesso em ${signedAt}.
            </p>
            <p style="color: #333; font-size: 14px; line-height: 1.6;">
              Você pode acessar o portal do cliente para baixar o PDF do contrato assinado a qualquer momento.
            </p>
            <p style="color: #666; font-size: 12px; margin-top: 16px;">
              Este email foi enviado automaticamente pelo sistema Lexia.
            </p>
          </div>
        </div>
      `;

      emailPromises.push(
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Lexia <onboarding@resend.dev>",
            to: [clientEmail],
            subject: `Confirmação: Contrato "${contractTitle}" assinado`,
            html: clientHtml,
          }),
        })
      );
    }

    const results = await Promise.allSettled(emailPromises);
    const failures = results.filter((r) => r.status === "rejected");

    return new Response(
      JSON.stringify({
        success: true,
        emails_sent: results.length - failures.length,
        emails_failed: failures.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
