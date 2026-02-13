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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub as string;
    const { contract_id } = await req.json();

    if (!contract_id) {
      return new Response(JSON.stringify({ error: "contract_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch contract
    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", contract_id)
      .single();

    if (cErr || !contract) {
      return new Response(JSON.stringify({ error: "Contract not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (contract.status !== "active") {
      return new Response(JSON.stringify({ error: "Contract is not active" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!contract.amount_cents || contract.amount_cents <= 0) {
      return new Response(JSON.stringify({ error: "Contract has no amount" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate due date based on periodicity
    const now = new Date();
    let dueDate: string;
    const periodicity = contract.periodicity || "monthly";
    
    if (periodicity === "once") {
      dueDate = contract.end_date || new Date(now.getTime() + 30 * 86400000).toISOString().split("T")[0];
    } else if (periodicity === "quarterly") {
      dueDate = new Date(now.getFullYear(), now.getMonth() + 3, 10).toISOString().split("T")[0];
    } else if (periodicity === "yearly") {
      dueDate = new Date(now.getFullYear() + 1, now.getMonth(), 10).toISOString().split("T")[0];
    } else {
      // monthly default
      dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 10).toISOString().split("T")[0];
    }

    // Check if invoice already exists for this period
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const { data: existing } = await supabase
      .from("invoices")
      .select("id")
      .eq("organization_id", contract.organization_id)
      .eq("client_id", contract.client_id)
      .gte("created_at", `${monthKey}-01`)
      .lt("created_at", `${monthKey}-32`)
      .limit(1);

    if (existing && existing.length > 0 && periodicity !== "once") {
      return new Response(JSON.stringify({ 
        error: "Invoice already exists for this period",
        existing_invoice_id: existing[0].id,
      }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create invoice
    const { data: invoice, error: iErr } = await supabase
      .from("invoices")
      .insert({
        organization_id: contract.organization_id,
        user_id: userId,
        client_id: contract.client_id,
        amount_cents: contract.amount_cents,
        currency: contract.currency || "BRL",
        description: `Cobrança ref. contrato: ${contract.title}`,
        due_date: dueDate,
        status: "pending",
        metadata: { contract_id: contract.id, periodicity, auto_generated: true },
      } as any)
      .select("id")
      .single();

    if (iErr) {
      console.error("Error creating invoice:", iErr);
      return new Response(JSON.stringify({ error: "Failed to create invoice" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit log
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await adminClient.from("audit_logs").insert({
      action: "invoice_auto_generated",
      user_id: userId,
      resource_type: "invoice",
      resource_id: invoice.id,
      organization_id: contract.organization_id,
      metadata: { contract_id: contract.id, amount_cents: contract.amount_cents, due_date: dueDate },
    });

    return new Response(JSON.stringify({
      success: true,
      invoice_id: invoice.id,
      amount_cents: contract.amount_cents,
      due_date: dueDate,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("generate-contract-invoices error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
