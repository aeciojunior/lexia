import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
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
  return <>{children}</>;
};
