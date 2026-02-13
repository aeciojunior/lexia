import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CLICKSIGN_API = "https://app.clicksign.com/api/v1";

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
    const CLICKSIGN_KEY = Deno.env.get("CLICKSIGN_API_KEY");
    if (!CLICKSIGN_KEY) {
      return new Response(JSON.stringify({ error: "CLICKSIGN_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { contract_id, signers } = await req.json();

    if (!contract_id || !signers?.length) {
      return new Response(JSON.stringify({ error: "contract_id and signers[] required" }), {
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

    // Build contract content for Clicksign
    const contractContent = [
      `CONTRATO: ${contract.title}`,
      `Tipo: ${contract.contract_type}`,
      contract.description ? `\nDescrição: ${contract.description}` : "",
      contract.clauses ? `\nCláusulas:\n${contract.clauses}` : "",
      contract.terms ? `\nTermos:\n${contract.terms}` : "",
      `\nValor: R$ ${((contract.amount_cents || 0) / 100).toFixed(2)}`,
      contract.start_date ? `Início: ${contract.start_date}` : "",
      contract.end_date ? `Término: ${contract.end_date}` : "",
    ].filter(Boolean).join("\n");

    // 1. Create document on Clicksign
    const docRes = await fetch(`${CLICKSIGN_API}/documents?access_token=${CLICKSIGN_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document: {
          path: `/contratos/${contract_id}.txt`,
          content_base64: btoa(unescape(encodeURIComponent(contractContent))),
          deadline_at: contract.end_date || new Date(Date.now() + 30 * 86400000).toISOString(),
          auto_close: true,
          locale: "pt-BR",
          sequence_enabled: false,
        },
      }),
    });

    if (!docRes.ok) {
      const err = await docRes.text();
      console.error("Clicksign create doc error:", docRes.status, err);
      return new Response(JSON.stringify({ error: `Clicksign error: ${docRes.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const docData = await docRes.json();
    const documentKey = docData.document?.key;

    if (!documentKey) {
      return new Response(JSON.stringify({ error: "No document key returned from Clicksign" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Add signers
    const signerKeys: string[] = [];
    for (const signer of signers) {
      const signerRes = await fetch(`${CLICKSIGN_API}/signers?access_token=${CLICKSIGN_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signer: {
            email: signer.email,
            name: signer.name,
            phone_number: signer.phone || undefined,
            auths: ["email"],
            delivery: "email",
          },
        }),
      });

      if (!signerRes.ok) {
        const err = await signerRes.text();
        console.error("Clicksign create signer error:", signerRes.status, err);
        continue;
      }

      const signerData = await signerRes.json();
      const signerKey = signerData.signer?.key;
      if (signerKey) signerKeys.push(signerKey);
    }

    // 3. Add signers to document
    for (const signerKey of signerKeys) {
      await fetch(`${CLICKSIGN_API}/lists?access_token=${CLICKSIGN_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          list: { document_key: documentKey, signer_key: signerKey, sign_as: "sign" },
        }),
      });
    }

    // 4. Send notification to signers
    for (const signerKey of signerKeys) {
      await fetch(`${CLICKSIGN_API}/notifications?access_token=${CLICKSIGN_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_signature_key: signerKey,
          message: `Por favor, assine o contrato "${contract.title}".`,
        }),
      });
    }

    // 5. Update contract metadata with Clicksign document key
    await supabase.from("contracts").update({
      metadata: { ...(contract.metadata || {}), clicksign_document_key: documentKey, clicksign_status: "sent" },
    } as any).eq("id", contract_id);

    // 6. Audit log
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await adminClient.from("audit_logs").insert({
      action: "contract_sent_for_signature",
      user_id: userId,
      resource_type: "contract",
      resource_id: contract_id,
      organization_id: contract.organization_id,
      metadata: { provider: "clicksign", document_key: documentKey, signers_count: signerKeys.length },
    });

    return new Response(JSON.stringify({
      success: true,
      document_key: documentKey,
      signers_added: signerKeys.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("clicksign-send error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
