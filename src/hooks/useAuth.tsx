import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        setSession(session);
        setLoading(false);
      }
    });

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!cancelled) {
          setSession(session);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Redirect after OAuth login
  useEffect(() => {
    if (loading || !session) return;
    const stored = sessionStorage.getItem("oauth_redirect");
    if (!stored) return;
    sessionStorage.removeItem("oauth_redirect");
    const path = stored.startsWith("/") && !stored.startsWith("//") ? stored : "/dashboard";
    if (window.location.pathname !== path) {
      window.location.replace(path);
    }
  }, [session, loading]);

  const signOut = async () => {
    if (session?.user) {
      try {
        await supabase.from("audit_logs").insert({
          action: "logout",
          user_id: session.user.id,
          resource_type: "auth",
          metadata: {
            user_agent: navigator.userAgent,
          },
        } as any);
      } catch {}
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
