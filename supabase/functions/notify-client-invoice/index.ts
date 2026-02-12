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

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { invoice_id } = await req.json();
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch invoice with client info
    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select("*, clients(full_name, email)")
      .eq("id", invoice_id)
      .single();

    if (invError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = (invoice as any).clients;
    if (!client?.email) {
      return new Response(JSON.stringify({ error: "Client has no email", skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    const orgName = org?.name || "Escritório";

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: #e0e0ff; margin: 0; font-size: 20px;">📄 Nova Fatura — ${orgName}</h1>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #333;">Olá, <strong>${client.full_name}</strong>!</p>
          <p style="color: #555;">Uma nova fatura foi criada para você:</p>
          
          <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 13px;">Descrição</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${invoice.description || "Sem descrição"}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 13px;">Valor</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #2563eb;">${formatBRL(invoice.amount_cents)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 13px;">Vencimento</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${dueDate}</td>
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
        subject: `📄 Nova fatura: ${formatBRL(invoice.amount_cents)} — ${orgName}`,
        html: htmlContent,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error(`Resend API error [${resendRes.status}]: ${errBody}`);
      return new Response(JSON.stringify({ error: "Failed to send email", details: errBody }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Invoice notification sent to ${client.email} for invoice ${invoice_id}`);

    return new Response(JSON.stringify({ success: true, sent_to: client.email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in notify-client-invoice:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
