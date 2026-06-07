import { supabase } from "@/integrations/supabase/client";

/** Returns the current user's access token for authenticated edge function calls. */
export async function getAccessToken(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  return session.access_token;
}
