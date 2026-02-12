import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    console.log("PagSeguro webhook received:", JSON.stringify(body));

    // PagSeguro sends notifications with charges array
    const charges = body.charges || [];
    if (charges.length === 0 && body.id) {
      // Alternative format: order-level notification
      charges.push(body);
    }

    for (const charge of charges) {
      const status = charge.status?.toUpperCase();
      const orderId = body.id || charge.id;

      if (!orderId) continue;

      // Find invoice by external_id (order id)
      const { data: invoice, error: invError } = await supabase
        .from("invoices")
        .select("id, organization_id, status, amount_cents, client_id, description, metadata")
        .eq("external_id", orderId)
        .single();

      if (invError || !invoice) {
        console.log(`Invoice not found for order ${orderId}`);
        continue;
      }

      let newStatus: string | null = null;
      let paidAt: string | null = null;

      if (status === "PAID" || status === "AVAILABLE") {
        newStatus = "paid";
        paidAt = new Date().toISOString();
      } else if (status === "DECLINED" || status === "CANCELED") {
        newStatus = "cancelled";
      } else if (status === "IN_ANALYSIS") {
        newStatus = "pending";
      }

      if (!newStatus || newStatus === invoice.status) continue;

      // Update invoice
      await supabase
        .from("invoices")
        .update({
          status: newStatus,
          paid_at: paidAt,
          metadata: {
            ...(invoice.metadata as Record<string, unknown> || {}),
            pagseguro_last_status: status,
            pagseguro_webhook_at: new Date().toISOString(),
          },
        })
        .eq("id", invoice.id);

      // Create payment record if paid
      if (newStatus === "paid") {
        const method = (invoice.metadata as any)?.pagseguro_method || "other";
        await supabase.from("payments").insert({
          organization_id: invoice.organization_id,
          user_id: "00000000-0000-0000-0000-000000000000", // system
          invoice_id: invoice.id,
          amount_cents: invoice.amount_cents,
          method,
          status: "confirmed",
          paid_at: paidAt,
          external_id: orderId,
          metadata: { source: "pagseguro_webhook", charge_status: status },
        });
      }

      // Create notification for org admins
      const { data: orgMembers } = await supabase
        .from("user_organizations")
        .select("user_id, role")
        .eq("organization_id", invoice.organization_id)
        .in("role", ["owner", "admin"]);

      if (orgMembers) {
        const statusLabel = newStatus === "paid" ? "confirmado" : newStatus === "cancelled" ? "cancelado" : "atualizado";
        const notifications = orgMembers.map((m) => ({
          user_id: m.user_id,
          organization_id: invoice.organization_id,
          type: "payment",
          title: `Pagamento ${statusLabel}`,
          message: `O pagamento da fatura "${invoice.description || "Sem descrição"}" (R$ ${(invoice.amount_cents / 100).toFixed(2).replace(".", ",")}) foi ${statusLabel} via PagSeguro.`,
          resource_type: "invoice",
          resource_id: invoice.id,
        }));
        await supabase.from("notifications").insert(notifications);
      }

      // Audit log
      await supabase.from("audit_logs").insert({
        action: `payment_${newStatus}`,
        organization_id: invoice.organization_id,
        resource_type: "invoice",
        resource_id: invoice.id,
        metadata: { source: "pagseguro_webhook", order_id: orderId, status, new_status: newStatus },
      });

      console.log(`Invoice ${invoice.id} updated to ${newStatus}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
