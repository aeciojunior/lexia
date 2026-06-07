import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function requireAuth(
  req: Request,
): Promise<
  | { ok: true; userId: string; supabase: SupabaseClient }
  | { ok: false; response: Response }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, response: jsonResponse({ error: "Não autorizado" }, 401) };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) {
    return { ok: false, response: jsonResponse({ error: "Não autorizado" }, 401) };
  }

  return { ok: true, userId: claimsData.claims.sub as string, supabase };
}

export async function requireOrgMember(
  supabase: SupabaseClient,
  userId: string,
  orgId: string,
): Promise<Response | null> {
  if (!orgId) {
    return jsonResponse({ error: "organization_id é obrigatório" }, 400);
  }

  const { data: isMember } = await supabase.rpc("is_org_member", {
    _user_id: userId,
    _org_id: orgId,
  });

  if (!isMember) {
    return jsonResponse({ error: "Sem acesso à organização" }, 403);
  }

  return null;
}

/** Protect cron/notification endpoints from public invocation. */
export function verifyCronSecret(req: Request): Response | null {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret) return null;

  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${secret}`) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  return null;
}
