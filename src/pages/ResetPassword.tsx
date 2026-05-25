import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LexLogo } from "@/components/lexia/LexLogo";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Lock, ArrowRight, CheckCircle, XCircle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordCheck {
  label: string;
  test: (pw: string) => boolean;
}

const PASSWORD_CHECKS: PasswordCheck[] = [
  { label: "Mínimo 8 caracteres", test: (pw) => pw.length >= 8 },
  { label: "Letra maiúscula", test: (pw) => /[A-Z]/.test(pw) },
  { label: "Letra minúscula", test: (pw) => /[a-z]/.test(pw) },
  { label: "Número", test: (pw) => /\d/.test(pw) },
  { label: "Caractere especial", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

const getStrengthLevel = (passed: number) => {
  if (passed <= 1) return { label: "Fraca", color: "bg-destructive", width: "w-1/5" };
  if (passed <= 2) return { label: "Fraca", color: "bg-destructive", width: "w-2/5" };
  if (passed <= 3) return { label: "Média", color: "bg-warning", width: "w-3/5" };
  if (passed <= 4) return { label: "Boa", color: "bg-accent", width: "w-4/5" };
  return { label: "Forte", color: "bg-accent", width: "w-full" };
};

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const passwordValid = useMemo(() => PASSWORD_CHECKS.every((c) => c.test(password)), [password]);
  const results = PASSWORD_CHECKS.map((c) => ({ ...c, passed: c.test(password) }));
  const passedCount = results.filter((r) => r.passed).length;
  const strength = getStrengthLevel(passedCount);

  // Supabase sends a RECOVERY event when the user clicks the reset link
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });

    // Also check if there's already a session (user may have already loaded)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordValid) {
      toast.error("A senha não atende aos requisitos mínimos.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (!sessionReady) {
      setError("Link inválido ou expirado. Solicite uma nova recuperação de senha.");
      return;
    }

    setLoading(true);
    const { error: updateError, data } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      if (updateError.message.toLowerCase().includes("same password")) {
        toast.error("A nova senha deve ser diferente da anterior.");
      } else {
        toast.error(updateError.message);
      }
      return;
    }

    // Audit log
    if (data.user) {
      try {
        await supabase.from("audit_logs").insert({
          action: "password_reset_success",
          user_id: data.user.id,
          resource_type: "auth",
          metadata: { user_agent: navigator.userAgent },
        } as any);
      } catch {}
    }

    setSuccess(true);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-8"><LexLogo size="md" /></div>
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-center justify-center">
              <XCircle className="h-10 w-10 text-destructive" />
            </div>
          </div>
          <h2 className="text-display-lg mb-3">Link inválido</h2>
          <p className="text-body-sm text-muted-foreground mb-8">{error}</p>
          <Button variant="outline" className="w-full h-12 rounded-xl" onClick={() => navigate("/auth")}>
            Voltar para o login
          </Button>
        </motion.div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-8"><LexLogo size="md" /></div>
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center shadow-glow-accent">
              <ShieldCheck className="h-10 w-10 text-accent" />
            </div>
          </div>
          <h2 className="text-display-lg mb-3">Senha redefinida!</h2>
          <p className="text-body-sm text-muted-foreground mb-8">
            Sua senha foi atualizada com sucesso. Você já pode acessar o sistema.
          </p>
          <Button variant="hero" className="w-full h-12 rounded-xl" onClick={() => navigate("/dashboard")}>
            Ir para o Dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="flex justify-center mb-8"><LexLogo size="md" /></div>

        <h2 className="text-display-lg mb-1 text-center">Redefinir senha</h2>
        <p className="text-body-sm text-muted-foreground mb-8 text-center">
          Escolha uma nova senha segura para sua conta.
        </p>

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nova senha"
                className="pl-10 h-12 rounded-xl bg-muted border-border"
                required
                minLength={8}
              />
            </div>

            {/* Strength bar */}
            {password && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2 mt-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-300", strength.color, strength.width)} />
                  </div>
                  <span className={cn("text-[10px] font-semibold", passedCount >= 4 ? "text-accent" : passedCount >= 3 ? "text-warning" : "text-destructive")}>
                    {strength.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                  {results.map((r) => (
                    <div key={r.label} className="flex items-center gap-1">
                      {r.passed ? (
                        <CheckCircle className="h-3 w-3 text-accent shrink-0" />
                      ) : (
                        <XCircle className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                      )}
                      <span className={cn("text-[10px]", r.passed ? "text-foreground" : "text-muted-foreground/60")}>{r.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar nova senha"
              className={cn(
                "pl-10 h-12 rounded-xl bg-muted border-border",
                confirmPassword && confirmPassword !== password && "border-destructive"
              )}
              required
              minLength={8}
            />
          </div>
          {confirmPassword && confirmPassword !== password && (
            <p className="text-caption text-destructive">As senhas não coincidem.</p>
          )}

          <Button
            type="submit"
            variant="hero"
            className="w-full h-12 rounded-xl text-base"
            disabled={loading || !passwordValid || password !== confirmPassword}
          >
            {loading ? (
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse-glow" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse-glow" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse-glow" style={{ animationDelay: "300ms" }} />
              </div>
            ) : (
              <>
                Redefinir senha
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button onClick={() => navigate("/auth")} className="text-body-sm text-muted-foreground hover:text-primary transition-colors">
            Voltar para o login
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
