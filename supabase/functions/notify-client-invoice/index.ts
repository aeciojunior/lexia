import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return jsonResponse({ error: "RESEND_API_KEY not configured" }, 500);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const { invoice_id } = await req.json();
    if (!invoice_id) {
      return jsonResponse({ error: "invoice_id is required" }, 400);
    }

    // Fetch invoice with client info
    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select("*, clients(full_name, email)")
      .eq("id", invoice_id)
      .single();

    if (invError || !invoice) {
      return jsonResponse({ error: "Invoice not found" }, 404);
    }

    const { data: membership } = await supabase
      .from("user_organizations")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("organization_id", invoice.organization_id)
      .eq("status", "active")
      .maybeSingle();

    if (!["owner", "admin"].includes(membership?.role ?? "")) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const client = (invoice as any).clients;
    if (!client?.email) {
      return jsonResponse({ error: "Client has no email", skipped: true });
    }

    const formatBRL = (cents: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

    const dueDate = invoice.due_date
      ? new Date(invoice.due_date).toLocaleDateString("pt-BR")
      : "Não definido";

    // Fetch organization name
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", invoice.organization_id)
      .single();

    const orgName = escapeHtml(org?.name || "Escritório");
    const clientName = escapeHtml(client.full_name);
    const description = escapeHtml(invoice.description || "Sem descrição");
    const amount = escapeHtml(formatBRL(invoice.amount_cents));
    const safeDueDate = escapeHtml(dueDate);

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: #e0e0ff; margin: 0; font-size: 20px;">📄 Nova Fatura — ${orgName}</h1>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #333;">Olá, <strong>${clientName}</strong>!</p>
          <p style="color: #555;">Uma nova fatura foi criada para você:</p>
          
          <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 13px;">Descrição</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${description}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 13px;">Valor</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #2563eb;">${amount}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 13px;">Vencimento</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${safeDueDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 13px;">Status</td>
                <td style="padding: 8px 0; text-align: right;">
                  <span style="background: #fef3c7; color: #92400e; padding: 2px 10px; border-radius: 9999px; font-size: 12px;">Pendente</span>
                </td>
              </tr>
            </table>
          </div>

          <p style="color: #555; font-size: 14px;">Acesse o <strong>Portal do Cliente</strong> para visualizar detalhes e efetuar o pagamento.</p>
          
          <p style="color: #888; font-size: 12px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
            Este é um email automático enviado por ${orgName} via Lexia.
          </p>
        </div>
      </div>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${orgName} <onboarding@resend.dev>`,
        to: [client.email],
        subject: `📄 Nova fatura: ${formatBRL(invoice.amount_cents)} — ${org?.name || "Escritório"}`,
        html: htmlContent,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error(`Resend API error [${resendRes.status}]: ${errBody}`);
      return jsonResponse({ error: "Failed to send email", details: errBody }, 500);
    }

    console.log(`Invoice notification sent to ${client.email} for invoice ${invoice_id}`);

    return jsonResponse({ success: true, sent_to: client.email });
  } catch (error) {
    console.error("Error in notify-client-invoice:", error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
