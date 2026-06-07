import { useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ORG_CHANGED_EVENT } from "@/lib/orgEvents";

type RouteState = "loading" | "unauthenticated" | "no-org" | "needs-onboarding" | "ready" | "error";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [state, setState] = useState<RouteState>("loading");
  const checkedUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setState("unauthenticated");
      return;
    }

    if (location.pathname === "/no-organization" || location.pathname === "/onboarding") {
      setState("ready");
      return;
    }

    let cancelled = false;

    const check = async () => {
      if (checkedUserRef.current !== user.id) {
        setState("loading");
      }

      try {
        const { data: memberships, error: membError } = await supabase
          .from("user_organizations")
          .select("organization_id")
          .eq("user_id", user.id)
          .limit(1);

        if (cancelled) return;

        if (membError) {
          setState("error");
          return;
        }

        if (!memberships || memberships.length === 0) {
          setState("no-org");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("active_organization_id, full_name")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;

        if (profileError) {
          setState("error");
          return;
        }

        let activeOrgId = profile?.active_organization_id;

        if (!activeOrgId) {
          activeOrgId = memberships[0].organization_id;
          await supabase
            .from("profiles")
            .update({ active_organization_id: activeOrgId })
            .eq("user_id", user.id);

          if (!cancelled) {
            window.dispatchEvent(new CustomEvent(ORG_CHANGED_EVENT));
          }
        }

        const { data: settings } = await supabase
          .from("organization_settings")
          .select("onboarding_completed")
          .eq("organization_id", activeOrgId)
          .maybeSingle();

        if (cancelled) return;

        if (settings?.onboarding_completed) {
          checkedUserRef.current = user.id;
          setState("ready");
          return;
        }

        const { data: org } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", activeOrgId)
          .maybeSingle();

        if (cancelled) return;

        const defaultName = profile?.full_name || "Meu Escritório";
        if (org && (org.name === defaultName || org.name === "Meu Escritório")) {
          setState("needs-onboarding");
          return;
        }

        checkedUserRef.current = user.id;
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    };

    check();

    return () => {
      cancelled = true;
    };
  }, [user?.id, loading, location.pathname]);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex gap-1">
          <span className="h-3 w-3 rounded-full bg-primary animate-pulse-glow" />
          <span className="h-3 w-3 rounded-full bg-primary animate-pulse-glow" style={{ animationDelay: "200ms" }} />
          <span className="h-3 w-3 rounded-full bg-primary animate-pulse-glow" style={{ animationDelay: "400ms" }} />
        </div>
      </div>
    );
  }

  if (state === "unauthenticated") return <Navigate to="/auth" replace />;
  if (state === "no-org") return <Navigate to="/no-organization" replace />;
  if (state === "needs-onboarding") return <Navigate to="/onboarding" replace />;

  if (state === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6">
        <p className="text-body-sm text-muted-foreground">Erro ao verificar sua conta. Tente novamente.</p>
        <button
          type="button"
          className="text-sm text-primary hover:underline"
          onClick={() => {
            checkedUserRef.current = null;
            setState("loading");
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
