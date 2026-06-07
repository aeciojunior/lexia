import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCronSecret } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cronDenied = verifyCronSecret(req);
  if (cronDenied) return cronDenied;

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in7DaysStr = in7Days.toISOString().split("T")[0];

    // Get invoices due within 7 days that are pending or draft (not paid/cancelled)
    const { data: invoices, error: dbError } = await supabase
      .from("invoices")
      .select("id, description, amount_cents, due_date, status, user_id, organization_id, client_id")
      .in("status", ["pending", "draft"])
      .not("due_date", "is", null)
      .gte("due_date", todayStr)
      .lte("due_date", in7DaysStr);

    if (dbError) throw dbError;

    if (!invoices || invoices.length === 0) {
      return new Response(JSON.stringify({ message: "No invoices due soon", sent: 0, inApp: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by user_id
    const byUser: Record<string, typeof invoices> = {};
    for (const inv of invoices) {
      if (!byUser[inv.user_id]) byUser[inv.user_id] = [];
      byUser[inv.user_id].push(inv);
    }

    let totalEmailSent = 0;
    let totalInApp = 0;

    for (const [userId, userInvoices] of Object.entries(byUser)) {
      // Get user profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("email_notifications, notify_in_app, full_name, active_organization_id")
        .eq("user_id", userId)
        .maybeSingle();

      // --- Check for duplicate notifications today ---
      const invoiceIds = userInvoices.map((inv: any) => inv.id);
      const { data: existing } = await supabase
        .from("notifications")
        .select("resource_id")
        .eq("user_id", userId)
        .eq("resource_type", "invoice")
        .in("resource_id", invoiceIds)
        .gte("created_at", todayStr + "T00:00:00Z");

      const alreadyNotified = new Set((existing || []).map((n: any) => n.resource_id));
      const newInvoices = userInvoices.filter((inv: any) => !alreadyNotified.has(inv.id));

      if (newInvoices.length === 0) continue;

      // --- In-app notifications ---
      if (profileData?.notify_in_app !== false) {
        const inAppRows = newInvoices.map((inv: any) => {
          const dueDate = new Date(inv.due_date);
          const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const isUrgent = daysUntil <= 2;
          const formatBRL = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
          return {
            user_id: userId,
            organization_id: inv.organization_id || profileData?.active_organization_id,
            type: isUrgent ? "deadline_approaching" : "deadline_created",
            title: isUrgent ? "🔴 Fatura vence em breve" : "💰 Fatura próxima do vencimento",
            message: `${inv.description || "Fatura"} — ${formatBRL(inv.amount_cents)} — Vence em ${dueDate.toLocaleDateString("pt-BR")}`,
            resource_id: inv.id,
            resource_type: "invoice",
          };
        });

        const { error: notifError } = await supabase.from("notifications").insert(inAppRows);
        if (notifError) {
          console.error(`Failed to create in-app notifications for ${userId}:`, notifError);
        } else {
          totalInApp += inAppRows.length;
        }
      }

      // --- Email notifications ---
      if (profileData?.email_notifications !== false && RESEND_API_KEY) {
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
        if (userError || !userData?.user?.email) {
          console.error(`Could not get email for user ${userId}:`, userError);
          continue;
        }

        const email = userData.user.email;
        const userName = profileData?.full_name || userData.user.user_metadata?.full_name || "Usuário";

        // Get client names
        const clientIds = [...new Set(newInvoices.map((inv: any) => inv.client_id).filter(Boolean))];
        let clientMap: Record<string, string> = {};
        if (clientIds.length > 0) {
          const { data: clients } = await supabase
            .from("clients")
            .select("id, full_name")
            .in("id", clientIds);
          if (clients) {
            clientMap = Object.fromEntries(clients.map((c: any) => [c.id, c.full_name]));
          }
        }

        const formatBRL = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

        const invoiceRows = newInvoices.map((inv: any) => {
          const dueDate = new Date(inv.due_date);
          const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const urgency = daysUntil <= 1 ? "🔴 Hoje" : daysUntil <= 2 ? "🟠 Urgente" : "🟡 Em breve";
          const clientName = inv.client_id ? (clientMap[inv.client_id] || "—") : "—";
          return `
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #eee;">${urgency}</td>
              <td style="padding: 12px; border-bottom: 1px solid #eee;"><strong>${inv.description || "Sem descrição"}</strong></td>
              <td style="padding: 12px; border-bottom: 1px solid #eee;">${clientName}</td>
              <td style="padding: 12px; border-bottom: 1px solid #eee;">${formatBRL(inv.amount_cents)}</td>
              <td style="padding: 12px; border-bottom: 1px solid #eee;">${dueDate.toLocaleDateString("pt-BR")}</td>
            </tr>`;
        }).join("");

        const totalAmount = newInvoices.reduce((s: number, inv: any) => s + (inv.amount_cents || 0), 0);

        const htmlContent = `
          <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 24px; border-radius: 12px 12px 0 0;">
              <h1 style="color: #e0e0ff; margin: 0; font-size: 20px;">💰 Lexia — Alerta de Faturas</h1>
            </div>
            <div style="background: #ffffff; padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="color: #333;">Olá, <strong>${userName}</strong>!</p>
              <p style="color: #555;">Você tem <strong>${newInvoices.length}</strong> fatura(s) vencendo nos próximos 7 dias, totalizando <strong>${formatBRL(totalAmount)}</strong>:</p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <thead>
                  <tr style="background: #f5f5f5;">
                    <th style="padding: 10px; text-align: left; font-size: 12px; color: #666;">Status</th>
                    <th style="padding: 10px; text-align: left; font-size: 12px; color: #666;">Descrição</th>
                    <th style="padding: 10px; text-align: left; font-size: 12px; color: #666;">Cliente</th>
                    <th style="padding: 10px; text-align: left; font-size: 12px; color: #666;">Valor</th>
                    <th style="padding: 10px; text-align: left; font-size: 12px; color: #666;">Vencimento</th>
                  </tr>
                </thead>
                <tbody>${invoiceRows}</tbody>
              </table>
              <p style="color: #888; font-size: 12px; margin-top: 24px;">Este é um email automático do sistema Lexia.</p>
            </div>
          </div>`;

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Lexia <onboarding@resend.dev>",
            to: [email],
            subject: `💰 ${newInvoices.length} fatura(s) vencendo em breve — ${formatBRL(totalAmount)} — Lexia`,
            html: htmlContent,
          }),
        });

        if (!resendRes.ok) {
          const errBody = await resendRes.text();
          console.error(`Resend API error [${resendRes.status}]: ${errBody}`);
        } else {
          totalEmailSent++;
          console.log(`Sent invoice email to ${email} for ${newInvoices.length} invoice(s)`);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, emailsSent: totalEmailSent, inAppCreated: totalInApp }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in invoice-notifications:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
