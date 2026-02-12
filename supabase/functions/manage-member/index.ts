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

  const { data: userData, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { action, ...params } = await req.json();

    // Helper: get caller's role in org
    const getCallerRole = async (orgId: string) => {
      const { data } = await supabase
        .from("user_organizations")
        .select("role")
        .eq("user_id", userId)
        .eq("organization_id", orgId)
        .eq("status", "active")
        .maybeSingle();
      return data?.role;
    };

    // RF-011: Change role
    if (action === "change-role") {
      const { organization_id, member_user_id, new_role } = params;

      const callerRole = await getCallerRole(organization_id);
      if (!callerRole || !["admin", "owner"].includes(callerRole)) {
        return new Response(JSON.stringify({ error: "Sem permissão" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (member_user_id === userId) {
        return new Response(JSON.stringify({ error: "Você não pode alterar seu próprio papel" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get target's current role
      const { data: target } = await supabase
        .from("user_organizations")
        .select("id, role")
        .eq("user_id", member_user_id)
        .eq("organization_id", organization_id)
        .maybeSingle();

      if (!target) {
        return new Response(JSON.stringify({ error: "Membro não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Admin restrictions
      if (callerRole === "admin") {
        if (["owner", "admin"].includes(target.role)) {
          return new Response(JSON.stringify({ error: "Admins não podem alterar papéis de Owners ou outros Admins" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (["owner", "admin"].includes(new_role)) {
          return new Response(JSON.stringify({ error: "Admins não podem promover a Owner ou Admin" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Owner cannot promote to owner
      if (new_role === "owner" && callerRole !== "owner") {
        return new Response(JSON.stringify({ error: "Apenas Owners podem promover a Owner" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const oldRole = target.role;
      const { error: updateError } = await supabase
        .from("user_organizations")
        .update({ role: new_role })
        .eq("id", target.id);

      if (updateError) throw updateError;

      // Audit
      await supabase.from("audit_logs").insert({
        organization_id,
        user_id: userId,
        action: "role_changed",
        resource_type: "user_organization",
        resource_id: target.id,
        metadata: {
          changed_user_id: member_user_id,
          old_role: oldRole,
          new_role,
          user_agent: req.headers.get("user-agent"),
        },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // RF-012: Disable user
    if (action === "disable-member") {
      const { organization_id, member_user_id } = params;

      const callerRole = await getCallerRole(organization_id);
      if (!callerRole || !["admin", "owner"].includes(callerRole)) {
        return new Response(JSON.stringify({ error: "Sem permissão" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (member_user_id === userId) {
        return new Response(JSON.stringify({ error: "Você não pode desativar a si mesmo" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: target } = await supabase
        .from("user_organizations")
        .select("id, role, status")
        .eq("user_id", member_user_id)
        .eq("organization_id", organization_id)
        .maybeSingle();

      if (!target) {
        return new Response(JSON.stringify({ error: "Membro não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (target.status === "disabled") {
        return new Response(JSON.stringify({ error: "Usuário já está desativado" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (callerRole === "admin" && ["owner", "admin"].includes(target.role)) {
        return new Response(JSON.stringify({ error: "Admins não podem desativar Owners ou outros Admins" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabase
        .from("user_organizations")
        .update({ status: "disabled" })
        .eq("id", target.id);

      if (updateError) throw updateError;

      // Clear active org if it's this one
      await supabase
        .from("profiles")
        .update({ active_organization_id: null })
        .eq("user_id", member_user_id)
        .eq("active_organization_id", organization_id);

      await supabase.from("audit_logs").insert({
        organization_id,
        user_id: userId,
        action: "user_disabled",
        resource_type: "user_organization",
        resource_id: target.id,
        metadata: { disabled_user_id: member_user_id, role: target.role, user_agent: req.headers.get("user-agent") },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // RF-012: Enable user
    if (action === "enable-member") {
      const { organization_id, member_user_id } = params;

      const callerRole = await getCallerRole(organization_id);
      if (!callerRole || !["admin", "owner"].includes(callerRole)) {
        return new Response(JSON.stringify({ error: "Sem permissão" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: target } = await supabase
        .from("user_organizations")
        .select("id, role, status")
        .eq("user_id", member_user_id)
        .eq("organization_id", organization_id)
        .maybeSingle();

      if (!target) {
        return new Response(JSON.stringify({ error: "Membro não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (target.status === "active") {
        return new Response(JSON.stringify({ error: "Usuário já está ativo" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabase
        .from("user_organizations")
        .update({ status: "active" })
        .eq("id", target.id);

      if (updateError) throw updateError;

      await supabase.from("audit_logs").insert({
        organization_id,
        user_id: userId,
        action: "user_enabled",
        resource_type: "user_organization",
        resource_id: target.id,
        metadata: { enabled_user_id: member_user_id, role: target.role, user_agent: req.headers.get("user-agent") },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação desconhecida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
