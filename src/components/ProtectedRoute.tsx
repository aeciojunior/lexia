import { useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (!user || location.pathname === "/onboarding") {
      setCheckingOnboarding(false);
      return;
    }

    const check = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_organization_id, full_name")
        .eq("user_id", user.id)
        .single();

      if (profile?.active_organization_id) {
        const { data: org } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", profile.active_organization_id)
          .single();

        // If org name matches the user's full_name (auto-created default), needs onboarding
        const defaultName = profile.full_name || "Meu Escritório";
        if (org && (org.name === defaultName || org.name === "Meu Escritório")) {
          setNeedsOnboarding(true);
        }
      }
      setCheckingOnboarding(false);
    };

    check();
  }, [user, location.pathname]);

  if (loading || checkingOnboarding) {
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

  if (!user) return <Navigate to="/auth" replace />;
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
};
