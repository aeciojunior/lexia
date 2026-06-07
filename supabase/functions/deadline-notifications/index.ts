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
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Get pending deadlines due within 48h that haven't been notified
    const { data: deadlines, error: dbError } = await supabase
      .from("deadlines")
      .select("*, processes(title, number)")
      .eq("status", "pending")
      .eq("notified", false)
      .lte("due_date", in48h.toISOString().split("T")[0])
      .gte("due_date", now.toISOString().split("T")[0]);

    if (dbError) throw dbError;

    if (!deadlines || deadlines.length === 0) {
      return new Response(JSON.stringify({ message: "No deadlines to notify", sent: 0, inApp: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group deadlines by user_id
    const byUser: Record<string, typeof deadlines> = {};
    for (const d of deadlines) {
      if (!byUser[d.user_id]) byUser[d.user_id] = [];
      byUser[d.user_id].push(d);
    }

    let totalEmailSent = 0;
    let totalInApp = 0;

    for (const [userId, userDeadlines] of Object.entries(byUser)) {
      // Get user profile with notification preferences
      const { data: profileData } = await supabase
        .from("profiles")
        .select("email_notifications, notify_deadlines, notify_in_app, full_name, active_organization_id")
        .eq("user_id", userId)
        .maybeSingle();

      // Skip if user disabled deadline notifications entirely
      if (profileData?.notify_deadlines === false) {
        console.log(`Skipping user ${userId} — deadline notifications disabled`);
        // Still mark as notified to avoid re-processing
        const ids = userDeadlines.map((d: any) => d.id);
        await supabase.from("deadlines").update({ notified: true }).in("id", ids);
        continue;
      }

      // --- In-app notifications ---
      if (profileData?.notify_in_app !== false) {
        const inAppRows = userDeadlines.map((d: any) => {
          const dueDate = new Date(d.due_date);
          const hoursUntil = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60));
          const isUrgent = hoursUntil <= 24;
          const processInfo = d.processes ? ` (${d.processes.number})` : "";
          return {
            user_id: userId,
            organization_id: d.organization_id || profileData?.active_organization_id,
            type: isUrgent ? "deadline_approaching" : "deadline_created",
            title: isUrgent ? "⚠️ Prazo urgente" : "⏰ Prazo próximo",
            message: `${d.title}${processInfo} — Vence em ${dueDate.toLocaleDateString("pt-BR")}${d.due_time ? " às " + d.due_time : ""}`,
            resource_id: d.id,
            resource_type: "deadline",
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
        } else {
          const email = userData.user.email;
          const userName = profileData?.full_name || userData.user.user_metadata?.full_name || "Usuário";

          const deadlineRows = userDeadlines
            .map((d: any) => {
              const dueDate = new Date(d.due_date);
              const hoursUntil = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60));
              const urgency = hoursUntil <= 24 ? "🔴 URGENTE" : "🟡 Em breve";
              const processInfo = d.processes ? ` (${d.processes.number})` : "";
              const priorityLabels: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente" };
              return `
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #eee;">${urgency}</td>
                  <td style="padding: 12px; border-bottom: 1px solid #eee;"><strong>${d.title}</strong>${processInfo}</td>
                  <td style="padding: 12px; border-bottom: 1px solid #eee;">${dueDate.toLocaleDateString("pt-BR")}${d.due_time ? " às " + d.due_time : ""}</td>
                  <td style="padding: 12px; border-bottom: 1px solid #eee;">${priorityLabels[d.priority] || d.priority}</td>
                </tr>`;
            })
            .join("");

          const htmlContent = `
            <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: #e0e0ff; margin: 0; font-size: 20px;">⚖️ Lexia — Alerta de Prazos</h1>
              </div>
              <div style="background: #ffffff; padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="color: #333;">Olá, <strong>${userName}</strong>!</p>
                <p style="color: #555;">Você tem <strong>${userDeadlines.length}</strong> prazo(s) vencendo nas próximas horas:</p>
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                  <thead>
                    <tr style="background: #f5f5f5;">
                      <th style="padding: 10px; text-align: left; font-size: 12px; color: #666;">Status</th>
                      <th style="padding: 10px; text-align: left; font-size: 12px; color: #666;">Prazo</th>
                      <th style="padding: 10px; text-align: left; font-size: 12px; color: #666;">Vencimento</th>
                      <th style="padding: 10px; text-align: left; font-size: 12px; color: #666;">Prioridade</th>
                    </tr>
                  </thead>
                  <tbody>${deadlineRows}</tbody>
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
              subject: `⚖️ ${userDeadlines.length} prazo(s) vencendo em breve — Lexia`,
              html: htmlContent,
            }),
          });

          if (!resendRes.ok) {
            const errBody = await resendRes.text();
            console.error(`Resend API error [${resendRes.status}]: ${errBody}`);
          } else {
            totalEmailSent++;
            console.log(`Sent email to ${email} for ${userDeadlines.length} deadline(s)`);
          }
        }
      }

      // Mark deadlines as notified
      const ids = userDeadlines.map((d: any) => d.id);
      await supabase.from("deadlines").update({ notified: true }).in("id", ids);
    }

    return new Response(JSON.stringify({ success: true, emailsSent: totalEmailSent, inAppCreated: totalInApp }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in deadline-notifications:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
