import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get movements created in the last hour that haven't been notified
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: movements, error: mvErr } = await supabase
      .from("process_movements")
      .select("id, title, description, movement_type, movement_date, process_id, organization_id, user_id, processes(title, number, responsible_id)")
      .gte("created_at", oneHourAgo)
      .order("created_at", { ascending: false });

    if (mvErr) throw mvErr;
    if (!movements || movements.length === 0) {
      return new Response(JSON.stringify({ message: "No new movements" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let notificationsCreated = 0;

    for (const mv of movements) {
      const process = mv.processes as any;
      if (!process) continue;

      // Get org members to notify (exclude the person who created the movement)
      const { data: members } = await supabase
        .from("user_organizations")
        .select("user_id")
        .eq("organization_id", mv.organization_id)
        .eq("status", "active")
        .neq("user_id", mv.user_id);

      if (!members || members.length === 0) continue;

      // Check if notification already exists for this movement
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("resource_type", "process_movement")
        .eq("resource_id", mv.id)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Create in-app notifications for all org members
      const notifications = members.map((m: any) => ({
        user_id: m.user_id,
        organization_id: mv.organization_id,
        title: `Nova movimentação: ${process.number}`,
        message: `${mv.title} — Processo ${process.title}`,
        type: "movement",
        resource_type: "process_movement",
        resource_id: mv.id,
      }));

      const { error: notifErr } = await supabase.from("notifications").insert(notifications);
      if (notifErr) {
        console.error("Error creating notifications:", notifErr);
        continue;
      }
      notificationsCreated += notifications.length;

      // Send email to responsible if configured
      if (resendKey && process.responsible_id && process.responsible_id !== mv.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email_notifications")
          .eq("user_id", process.responsible_id)
          .maybeSingle();

        if (profile?.email_notifications) {
          const { data: authUser } = await supabase.auth.admin.getUserById(process.responsible_id);
          const email = authUser?.user?.email;
          if (email) {
            try {
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  from: "LexIA <noreply@lexia.app>",
                  to: [email],
                  subject: `Nova movimentação no processo ${process.number}`,
                  html: `
                    <h2>Nova Movimentação Processual</h2>
                    <p><strong>Processo:</strong> ${process.number} — ${process.title}</p>
                    <p><strong>Movimentação:</strong> ${mv.title}</p>
                    ${mv.description ? `<p>${mv.description}</p>` : ""}
                    <p><strong>Data:</strong> ${new Date(mv.movement_date).toLocaleDateString("pt-BR")}</p>
                    <br/>
                    <p>Acesse a plataforma para mais detalhes.</p>
                  `,
                }),
              });
            } catch (emailErr) {
              console.error("Email send error:", emailErr);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ message: `Processed ${movements.length} movements, created ${notificationsCreated} notifications` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Movement notification error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
