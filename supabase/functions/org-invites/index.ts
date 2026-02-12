import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  // Authenticate the caller
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = claimsData.claims.sub;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { action, ...params } = await req.json();

    if (action === "send-invite") {
      const { organization_id, email, role } = params;

      // Verify caller is admin/owner of this org
      const { data: membership } = await supabase
        .from("user_organizations")
        .select("role")
        .eq("user_id", userId)
        .eq("organization_id", organization_id)
        .maybeSingle();

      if (!membership || !["admin", "owner"].includes(membership.role)) {
        return new Response(JSON.stringify({ error: "Sem permissão" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already a member
      const { data: existingUser } = await supabase.auth.admin.listUsers();
      const targetUser = existingUser?.users?.find((u: any) => u.email === email);
      if (targetUser) {
        const { data: existingMember } = await supabase
          .from("user_organizations")
          .select("id")
          .eq("user_id", targetUser.id)
          .eq("organization_id", organization_id)
          .maybeSingle();
        if (existingMember) {
          return new Response(JSON.stringify({ error: "Usuário já é membro desta organização" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Create invite
      const { data: invite, error: inviteError } = await supabase
        .from("organization_invites")
        .insert({
          organization_id,
          email,
          role: role || "user",
          invited_by: userId,
        })
        .select()
        .single();

      if (inviteError) {
        if (inviteError.code === "23505") {
          return new Response(JSON.stringify({ error: "Convite já enviado para este email" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw inviteError;
      }

      // Get org name
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", organization_id)
        .single();

      // Get inviter name
      const { data: inviterProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", userId)
        .maybeSingle();

      const inviterName = inviterProfile?.full_name || "Um administrador";
      const orgName = org?.name || "uma organização";

      // Send email if Resend is configured
      if (RESEND_API_KEY) {
        const acceptUrl = `${req.headers.get("origin") || supabaseUrl}/invite/${invite.token}`;

        const htmlContent = `
          <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 24px; border-radius: 12px 12px 0 0;">
              <h1 style="color: #e0e0ff; margin: 0; font-size: 20px;">⚖️ Lexia — Convite para Organização</h1>
            </div>
            <div style="background: #ffffff; padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="color: #333;">Olá!</p>
              <p style="color: #555;"><strong>${inviterName}</strong> convidou você para participar de <strong>${orgName}</strong> no Lexia.</p>
              <p style="color: #555;">Papel: <strong>${role || "user"}</strong></p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${acceptUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600;">Aceitar Convite</a>
              </div>
              <p style="color: #999; font-size: 12px;">Este convite expira em 7 dias.</p>
              <p style="color: #999; font-size: 12px;">Se você não tem conta, crie uma com o email ${email} e depois aceite o convite.</p>
            </div>
          </div>`;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Lexia <onboarding@resend.dev>",
            to: [email],
            subject: `⚖️ Convite para ${orgName} — Lexia`,
            html: htmlContent,
          }),
        });
      }

      // Audit log
      await supabase.from("audit_logs").insert({
        organization_id,
        user_id: userId,
        action: "invite_sent",
        resource_type: "organization_invite",
        resource_id: invite.id,
        metadata: { email, role },
      });

      return new Response(JSON.stringify({ success: true, invite }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "accept-invite") {
      const { token: inviteToken } = params;

      // Find invite by token
      const { data: invite, error: findError } = await supabase
        .from("organization_invites")
        .select("*")
        .eq("token", inviteToken)
        .eq("status", "pending")
        .maybeSingle();

      if (findError || !invite) {
        return new Response(JSON.stringify({ error: "Convite não encontrado ou já aceito" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check expiration
      if (new Date(invite.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "Convite expirado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check email matches
      const { data: callerUser } = await supabase.auth.admin.getUserById(userId);
      if (callerUser?.user?.email !== invite.email) {
        return new Response(JSON.stringify({ error: "Este convite foi enviado para outro email" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already member
      const { data: existingMember } = await supabase
        .from("user_organizations")
        .select("id")
        .eq("user_id", userId)
        .eq("organization_id", invite.organization_id)
        .maybeSingle();

      if (existingMember) {
        // Already a member, just mark invite as accepted
        await supabase.from("organization_invites").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", invite.id);
        return new Response(JSON.stringify({ success: true, message: "Você já é membro desta organização" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Add to organization
      const { error: joinError } = await supabase
        .from("user_organizations")
        .insert({
          user_id: userId,
          organization_id: invite.organization_id,
          role: invite.role,
        });

      if (joinError) throw joinError;

      // Update invite status
      await supabase.from("organization_invites").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", invite.id);

      // Set as active org
      await supabase.from("profiles").update({ active_organization_id: invite.organization_id }).eq("user_id", userId);

      // Audit log
      await supabase.from("audit_logs").insert({
        organization_id: invite.organization_id,
        user_id: userId,
        action: "invite_accepted",
        resource_type: "organization_invite",
        resource_id: invite.id,
        metadata: { role: invite.role },
      });

      return new Response(JSON.stringify({ success: true, organization_id: invite.organization_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação desconhecida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
