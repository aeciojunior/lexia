import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCronSecret } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cronDenied = verifyCronSecret(req);
  if (cronDenied) return cronDenied;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    const results = {
      hearing_notifications_sent: 0,
      invoice_notifications_sent: 0,
      errors: [] as string[],
    };

    // ============================================================
    // 1. NOTIFY CLIENTS ABOUT NEW HEARINGS (created in last 2 hours)
    // ============================================================
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: recentHearings, error: hearingsErr } = await supabase
      .from("hearings")
      .select("id, hearing_date, hearing_type, location, video_link, notes, organization_id, process_id, processes(title, number, client_name)")
      .gte("created_at", twoHoursAgo)
      .eq("status", "scheduled");

    if (hearingsErr) {
      console.error("Error fetching hearings:", hearingsErr.message);
    }

    for (const hearing of recentHearings || []) {
      const process = hearing.processes as any;
      if (!process?.client_name) continue;

      // Find client by name match in the org
      const { data: client } = await supabase
        .from("clients")
        .select("email, full_name")
        .eq("organization_id", hearing.organization_id)
        .ilike("full_name", process.client_name)
        .eq("status", "active")
        .maybeSingle();

      if (!client?.email) continue;

      // Check if we already notified (avoid duplicate notifications)
      const { data: existingNotif } = await supabase
        .from("notifications")
        .select("id")
        .eq("resource_id", hearing.id)
        .eq("resource_type", "hearing_client_email")
        .maybeSingle();

      if (existingNotif) continue;

      const hearingDate = new Date(hearing.hearing_date);
      const hearingTypeLabels: Record<string, string> = {
        initial: "Inicial", conciliation: "Conciliação", instruction: "Instrução",
        judgment: "Julgamento", other: "Audiência",
      };

      // Send email via Resend
      if (resendKey) {
        try {
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Lexia <noreply@resend.dev>",
              to: [client.email],
              subject: `Audiência agendada — ${process.title}`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: #1a1a2e; padding: 24px; border-radius: 12px 12px 0 0;">
                    <h1 style="color: #e0e0ff; margin: 0; font-size: 20px;">📋 Audiência Agendada</h1>
                  </div>
                  <div style="background: #f8f9fa; padding: 24px; border-radius: 0 0 12px 12px;">
                    <p style="color: #333;">Olá <strong>${client.full_name}</strong>,</p>
                    <p style="color: #555;">Uma audiência foi agendada para o seu processo:</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                      <tr>
                        <td style="padding: 8px 0; color: #888; width: 120px;">Processo</td>
                        <td style="padding: 8px 0; color: #333; font-weight: 600;">${process.title} (${process.number})</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #888;">Tipo</td>
                        <td style="padding: 8px 0; color: #333;">${hearingTypeLabels[hearing.hearing_type] || hearing.hearing_type}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #888;">Data</td>
                        <td style="padding: 8px 0; color: #333; font-weight: 600;">${hearingDate.toLocaleDateString("pt-BR")} às ${hearingDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #888;">Local</td>
                        <td style="padding: 8px 0; color: #333;">${hearing.location}</td>
                      </tr>
                      ${hearing.video_link ? `
                      <tr>
                        <td style="padding: 8px 0; color: #888;">Link</td>
                        <td style="padding: 8px 0;"><a href="${hearing.video_link}" style="color: #6366f1;">${hearing.video_link}</a></td>
                      </tr>` : ""}
                    </table>
                    ${hearing.notes ? `<p style="color: #555; background: #fff; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb;"><strong>Obs:</strong> ${hearing.notes}</p>` : ""}
                    <p style="color: #888; font-size: 12px; margin-top: 24px;">— Lexia</p>
                  </div>
                </div>
              `,
            }),
          });

          if (emailRes.ok) {
            results.hearing_notifications_sent++;
            console.log(`Hearing email sent to ${client.email} for hearing ${hearing.id}`);
          } else {
            const errData = await emailRes.text();
            console.error(`Resend error for hearing ${hearing.id}:`, errData);
            results.errors.push(`Hearing ${hearing.id}: ${errData}`);
          }
        } catch (e) {
          console.error(`Email error for hearing ${hearing.id}:`, e);
          results.errors.push(`Hearing ${hearing.id}: ${e.message}`);
        }
      }

      // Create in-app notification to mark as processed
      // Find the client's auth user
      const { data: authUser } = await supabase.rpc("get_client_id_for_user", {
        _user_id: "00000000-0000-0000-0000-000000000000", // placeholder
        _org_id: hearing.organization_id,
      });

      // Find user by email instead
      const { data: clientUsers } = await supabase
        .from("app_users")
        .select("auth_user_id")
        .ilike("email", client.email)
        .limit(1);

      if (clientUsers?.[0]) {
        await supabase.from("notifications").insert({
          user_id: clientUsers[0].auth_user_id,
          organization_id: hearing.organization_id,
          title: `Audiência agendada: ${hearingTypeLabels[hearing.hearing_type] || "Audiência"}`,
          message: `${process.title} — ${hearingDate.toLocaleDateString("pt-BR")} às ${hearingDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} em ${hearing.location}`,
          type: "hearing",
          resource_id: hearing.id,
          resource_type: "hearing_client_email",
        });
      }
    }

    // ============================================================
    // 2. NOTIFY CLIENTS ABOUT INVOICES NEAR DUE DATE (3 days before)
    // ============================================================
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const today = new Date().toISOString().split("T")[0];
    const targetDate = threeDaysFromNow.toISOString().split("T")[0];

    const { data: dueSoonInvoices, error: invErr } = await supabase
      .from("invoices")
      .select("id, amount_cents, description, due_date, client_id, organization_id, clients(email, full_name)")
      .in("status", ["pending", "draft"])
      .gte("due_date", today)
      .lte("due_date", targetDate);

    if (invErr) {
      console.error("Error fetching invoices:", invErr.message);
    }

    for (const invoice of dueSoonInvoices || []) {
      const client = invoice.clients as any;
      if (!client?.email) continue;

      // Check if already notified
      const { data: existingNotif } = await supabase
        .from("notifications")
        .select("id")
        .eq("resource_id", invoice.id)
        .eq("resource_type", "invoice_due_client_email")
        .maybeSingle();

      if (existingNotif) continue;

      const dueDate = new Date(invoice.due_date + "T00:00:00");
      const amount = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(invoice.amount_cents / 100);

      if (resendKey) {
        try {
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Lexia <noreply@resend.dev>",
              to: [client.email],
              subject: `Fatura próxima do vencimento — ${amount}`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: #1a1a2e; padding: 24px; border-radius: 12px 12px 0 0;">
                    <h1 style="color: #e0e0ff; margin: 0; font-size: 20px;">💰 Lembrete de Fatura</h1>
                  </div>
                  <div style="background: #f8f9fa; padding: 24px; border-radius: 0 0 12px 12px;">
                    <p style="color: #333;">Olá <strong>${client.full_name}</strong>,</p>
                    <p style="color: #555;">Sua fatura está próxima do vencimento:</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                      <tr>
                        <td style="padding: 8px 0; color: #888; width: 120px;">Descrição</td>
                        <td style="padding: 8px 0; color: #333;">${invoice.description || "Fatura"}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #888;">Valor</td>
                        <td style="padding: 8px 0; color: #333; font-weight: 700; font-size: 18px;">${amount}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #888;">Vencimento</td>
                        <td style="padding: 8px 0; color: #e53e3e; font-weight: 600;">${dueDate.toLocaleDateString("pt-BR")}</td>
                      </tr>
                    </table>
                    <p style="color: #555;">Acesse o portal do cliente para efetuar o pagamento.</p>
                    <p style="color: #888; font-size: 12px; margin-top: 24px;">— Lexia</p>
                  </div>
                </div>
              `,
            }),
          });

          if (emailRes.ok) {
            results.invoice_notifications_sent++;
            console.log(`Invoice due email sent to ${client.email} for invoice ${invoice.id}`);
          } else {
            const errData = await emailRes.text();
            console.error(`Resend error for invoice ${invoice.id}:`, errData);
            results.errors.push(`Invoice ${invoice.id}: ${errData}`);
          }
        } catch (e) {
          console.error(`Email error for invoice ${invoice.id}:`, e);
          results.errors.push(`Invoice ${invoice.id}: ${e.message}`);
        }
      }

      // Find client user and create in-app notification
      const { data: clientUsers } = await supabase
        .from("app_users")
        .select("auth_user_id")
        .ilike("email", client.email)
        .limit(1);

      if (clientUsers?.[0]) {
        await supabase.from("notifications").insert({
          user_id: clientUsers[0].auth_user_id,
          organization_id: invoice.organization_id,
          title: `Fatura vence em breve: ${amount}`,
          message: `${invoice.description || "Fatura"} — Vencimento: ${dueDate.toLocaleDateString("pt-BR")}`,
          type: "invoice",
          resource_id: invoice.id,
          resource_type: "invoice_due_client_email",
        });
      }
    }

    console.log("Client notifications completed:", results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Client notifications error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
