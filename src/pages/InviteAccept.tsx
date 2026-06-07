import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { LexCard } from "@/components/lexia/LexCard";
import { LexLogo } from "@/components/lexia/LexLogo";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const InviteAccept = () => {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "login-required">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setStatus("login-required");
      setMessage("Você precisa estar logado para aceitar o convite.");
      return;
    }

    let cancelled = false;

    const acceptInvite = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("org-invites", {
          body: { action: "accept-invite", token },
        });
        if (cancelled) return;
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        await queryClient.invalidateQueries({ queryKey: ["active-org", user.id] });
        await queryClient.invalidateQueries({ queryKey: ["user-organizations", user.id] });

        setStatus("success");
        setMessage(data?.message || "Convite aceito! Você agora faz parte da organização.");
      } catch (err: any) {
        if (!cancelled) {
          setStatus("error");
          setMessage(err.message || "Erro ao aceitar convite.");
        }
      }
    };

    acceptInvite();

    return () => {
      cancelled = true;
    };
  }, [token, user, authLoading, queryClient]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <LexLogo size="md" />
        </div>
        <LexCard hover={false} className="text-center">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
              <h2 className="text-display-sm mb-2">Processando convite...</h2>
              <p className="text-body-sm text-muted-foreground">Aguarde enquanto verificamos o convite.</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
              <h2 className="text-display-sm mb-2">Convite aceito!</h2>
              <p className="text-body-sm text-muted-foreground mb-6">{message}</p>
              <Button variant="hero" onClick={() => navigate("/dashboard")}>Ir para o Dashboard</Button>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-display-sm mb-2">Erro</h2>
              <p className="text-body-sm text-muted-foreground mb-6">{message}</p>
              <Button variant="outline" onClick={() => navigate("/dashboard")}>Voltar ao Dashboard</Button>
            </>
          )}

          {status === "login-required" && (
            <>
              <XCircle className="h-12 w-12 text-warning mx-auto mb-4" />
              <h2 className="text-display-sm mb-2">Login necessário</h2>
              <p className="text-body-sm text-muted-foreground mb-6">{message}</p>
              <Button variant="hero" onClick={() => navigate(`/auth?redirect=/invite/${token}`)}>Fazer login</Button>
            </>
          )}
        </LexCard>
      </motion.div>
    </div>
  );
};

export default InviteAccept;
