import { useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type RouteState = "loading" | "unauthenticated" | "no-org" | "needs-onboarding" | "ready";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [state, setState] = useState<RouteState>("loading");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setState("unauthenticated");
      return;
    }

    // Skip checks for specific routes
    if (location.pathname === "/no-organization" || location.pathname === "/onboarding") {
      setState("ready");
      return;
    }

    const check = async () => {
      // Check if user has any organizations
      const { data: memberships } = await supabase
        .from("user_organizations")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1);

      if (!memberships || memberships.length === 0) {
        setState("no-org");
        return;
      }

      // Check if active org is set, if not set first one
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_organization_id, full_name")
        .eq("user_id", user.id)
        .single();

      if (!profile?.active_organization_id) {
        // Set first org as active
        await supabase
          .from("profiles")
          .update({ active_organization_id: memberships[0].organization_id })
          .eq("user_id", user.id);
      }

      const activeOrgId = profile?.active_organization_id || memberships[0].organization_id;

      // Check if org needs onboarding (still has default name)
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", activeOrgId)
        .single();

      const defaultName = profile?.full_name || "Meu Escritório";
      if (org && (org.name === defaultName || org.name === "Meu Escritório")) {
        setState("needs-onboarding");
        return;
      }

      setState("ready");
    };

    check();
  }, [user, loading, location.pathname]);

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
  return <>{children}</>;
};
