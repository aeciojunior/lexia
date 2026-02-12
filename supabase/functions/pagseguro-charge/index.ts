import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAGSEGURO_API_URL = "https://api.pagseguro.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const PAGSEGURO_TOKEN = Deno.env.get("PAGSEGURO_API_TOKEN");
  if (!PAGSEGURO_TOKEN) {
    return new Response(
      JSON.stringify({ error: "PAGSEGURO_API_TOKEN não configurado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { invoice_id, method } = body; // method: "boleto" | "pix"

    if (!invoice_id || !method || !["boleto", "pix"].includes(method)) {
      return new Response(
        JSON.stringify({ error: "invoice_id e method (boleto|pix) são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch invoice
    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select("*, clients(full_name, email, document_number, document_type)")
      .eq("id", invoice_id)
      .single();

    if (invError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Fatura não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (invoice.status === "paid") {
      return new Response(
        JSON.stringify({ error: "Fatura já está paga" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const amountInReais = invoice.amount_cents / 100;
    const referenceId = `INV-${invoice.id.slice(0, 8)}`;
    const client = invoice.clients;

    // Build PagSeguro charge request
    const chargeBody: Record<string, unknown> = {
      reference_id: referenceId,
      description: invoice.description || `Cobrança ${referenceId}`,
      amount: {
        value: invoice.amount_cents,
        currency: "BRL",
      },
      payment_methods: [{ type: method === "pix" ? "PIX" : "BOLETO" }],
      notification_urls: [`${SUPABASE_URL}/functions/v1/pagseguro-webhook`],
    };

    // Add customer info if client exists
    if (client) {
      chargeBody.customer = {
        name: client.full_name || "Cliente",
        email: client.email || `noreply+${invoice.id.slice(0, 6)}@example.com`,
        tax_id: client.document_number || undefined,
      };
    }

    // Add boleto-specific fields
    if (method === "boleto") {
      const dueDate = invoice.due_date || new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
      (chargeBody as any).payment_methods[0].boleto = {
        due_date: dueDate,
        instruction_lines: {
          line_1: `Referência: ${referenceId}`,
          line_2: `Valor: R$ ${amountInReais.toFixed(2)}`,
        },
      };
    }

    // Call PagSeguro API
    const pgResponse = await fetch(`${PAGSEGURO_API_URL}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAGSEGURO_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(chargeBody),
    });

    const pgData = await pgResponse.json();

    if (!pgResponse.ok) {
      console.error("PagSeguro API error:", JSON.stringify(pgData));
      return new Response(
        JSON.stringify({
          error: `Erro na API do PagSeguro [${pgResponse.status}]`,
          details: pgData,
        }),
        { status: pgResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract payment link
    const paymentLink = pgData.links?.find((l: any) => l.rel === "PAY")?.href || null;
    const orderId = pgData.id;

    // Update invoice with external reference
    await supabase
      .from("invoices")
      .update({
        external_id: orderId,
        metadata: {
          ...(invoice.metadata || {}),
          pagseguro_order_id: orderId,
          pagseguro_method: method,
          pagseguro_payment_link: paymentLink,
          pagseguro_created_at: new Date().toISOString(),
        },
        status: "pending",
      })
      .eq("id", invoice_id);

    // Audit log
    await supabase.from("audit_logs").insert({
      action: "payment_charge_created",
      user_id: user.id,
      organization_id: invoice.organization_id,
      resource_type: "invoice",
      resource_id: invoice_id,
      metadata: { method, order_id: orderId, amount_cents: invoice.amount_cents },
    });

    return new Response(
      JSON.stringify({
        success: true,
        order_id: orderId,
        payment_link: paymentLink,
        method,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating charge:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
