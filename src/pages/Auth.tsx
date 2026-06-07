import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LexLogo } from "@/components/lexia/LexLogo";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Mail, Lock, User, CheckCircle, XCircle, MailCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import heroImage from "@/assets/hero-bg.jpg";

type AuthMode = "login" | "register" | "forgot" | "email-sent";

/* ── Password strength ── */
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

const getStrengthLevel = (passed: number): { label: string; color: string; width: string } => {
  if (passed <= 1) return { label: "Fraca", color: "bg-destructive", width: "w-1/5" };
  if (passed <= 2) return { label: "Fraca", color: "bg-destructive", width: "w-2/5" };
  if (passed <= 3) return { label: "Média", color: "bg-warning", width: "w-3/5" };
  if (passed <= 4) return { label: "Boa", color: "bg-accent", width: "w-4/5" };
  return { label: "Forte", color: "bg-accent", width: "w-full" };
};

const PasswordStrength = ({ password }: { password: string }) => {
  const results = PASSWORD_CHECKS.map((c) => ({ ...c, passed: c.test(password) }));
  const passedCount = results.filter((r) => r.passed).length;
  const strength = getStrengthLevel(passedCount);

  if (!password) return null;

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2 mt-2">
      {/* Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-300", strength.color, strength.width)} />
        </div>
        <span className={cn("text-[10px] font-semibold", passedCount >= 4 ? "text-accent" : passedCount >= 3 ? "text-warning" : "text-destructive")}>
          {strength.label}
        </span>
      </div>
      {/* Checklist */}
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
  );
};

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATIONS = [30, 60, 120, 300]; // progressive lockout in seconds

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const failedAttempts = useRef(0);
  const lockoutLevel = useRef(0);
  const lockoutTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [searchParams] = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/dashboard";
  const redirectTo =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/dashboard";
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    return () => {
      if (lockoutTimer.current) clearInterval(lockoutTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      navigate(redirectTo, { replace: true });
    }
  }, [user, authLoading, redirectTo, navigate]);

  const passwordValid = useMemo(() => {
    return PASSWORD_CHECKS.every((c) => c.test(password));
  }, [password]);

  const startLockout = useCallback(() => {
    const duration = LOCKOUT_DURATIONS[Math.min(lockoutLevel.current, LOCKOUT_DURATIONS.length - 1)];
    const until = Date.now() + duration * 1000;
    setLockoutUntil(until);
    setLockoutSeconds(duration);
    lockoutLevel.current++;

    if (lockoutTimer.current) clearInterval(lockoutTimer.current);
    lockoutTimer.current = setInterval(() => {
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setLockoutSeconds(0);
        failedAttempts.current = 0;
        if (lockoutTimer.current) clearInterval(lockoutTimer.current);
      } else {
        setLockoutSeconds(remaining);
      }
    }, 1000);
  }, []);

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;

  const mapAuthError = (message: string): string => {
    const msg = message.toLowerCase();
    if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials"))
      return "E-mail ou senha incorretos.";
    if (msg.includes("email not confirmed") || msg.includes("not confirmed"))
      return "Conta não confirmada. Verifique seu e-mail.";
    if (msg.includes("user not found") || msg.includes("no user found"))
      return "E-mail não encontrado.";
    if (msg.includes("too many requests") || msg.includes("rate limit"))
      return "Muitas tentativas. Aguarde alguns minutos.";
    if (msg.includes("user banned") || msg.includes("blocked"))
      return "Conta bloqueada. Entre em contato com o suporte.";
    return message;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLockedOut) {
      toast.error(`Conta temporariamente bloqueada. Aguarde ${lockoutSeconds}s.`);
      return;
    }

    setLoading(true);
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      failedAttempts.current++;
      const remaining = MAX_ATTEMPTS - failedAttempts.current;

      if (failedAttempts.current >= MAX_ATTEMPTS) {
        startLockout();
        toast.error(`Muitas tentativas falhas. Bloqueado por ${LOCKOUT_DURATIONS[Math.min(lockoutLevel.current - 1, LOCKOUT_DURATIONS.length - 1)]}s.`);
      } else {
        toast.error(`${mapAuthError(error.message)} (${remaining} tentativa${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""})`);
      }
      return;
    }

    failedAttempts.current = 0;
    lockoutLevel.current = 0;

    if (data.user) {
      supabase.from("audit_logs").insert({
        action: "login",
        user_id: data.user.id,
        resource_type: "auth",
        metadata: {
          method: "email",
          user_agent: navigator.userAgent,
        },
      } as any).then(() => {});
    }

    const { data: { session } } = await supabase.auth.getSession();
    setLoading(false);

    if (!session) {
      toast.error("Erro ao estabelecer sessão. Tente novamente.");
      return;
    }

    navigate(redirectTo, { replace: true });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValid) {
      toast.error("A senha não atende aos requisitos mínimos.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) {
      if (error.message?.toLowerCase().includes("already registered") || error.message?.toLowerCase().includes("already exists")) {
        toast.error("Este e-mail já está cadastrado.");
      } else {
        toast.error(error.message);
      }
    } else {
      setMode("email-sent");
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    // Always show the same message regardless of whether email exists (RF-007.1)
    if (error && error.message.toLowerCase().includes("rate limit")) {
      toast.error("Muitas tentativas. Aguarde alguns minutos.");
    } else {
      toast.success("Se este e-mail estiver cadastrado, enviaremos instruções para redefinir sua senha.");
      setMode("login");
    }
  };

  const handleOAuthLogin = async (provider: "google" | "apple") => {
    sessionStorage.setItem("oauth_redirect", redirectTo);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) toast.error(error.message);
  };

  const handleGoogleLogin = () => handleOAuthLogin("google");
  const handleAppleLogin = () => handleOAuthLogin("apple");

  const onSubmit = mode === "login" ? handleLogin : mode === "register" ? handleRegister : handleForgot;

  return (
    <div className="flex min-h-screen">
      {/* Left - immersive branding */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        <img src={heroImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
        <div className="absolute inset-0 dot-grid opacity-20" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <LexLogo size="lg" />

          <div className="max-w-lg">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="text-display-xl text-foreground mb-6"
            >
              Inteligência jurídica de{" "}
              <span className="gradient-text">próxima geração</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-body-lg text-muted-foreground"
            >
              IA avançada, automação e agentes inteligentes para transformar a gestão do seu escritório.
            </motion.p>
          </div>

          <div className="flex gap-8 text-sm text-muted-foreground">
            <div><span className="text-display-md gradient-text block">99.9%</span>Uptime</div>
            <div><span className="text-display-md gradient-text-accent block">500+</span>Escritórios</div>
            <div><span className="text-display-md gradient-text block">50k+</span>Processos</div>
          </div>
        </div>
      </div>

      {/* Right - form */}
      <div className="flex flex-1 flex-col justify-center items-center px-8 py-12 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-10 flex justify-center">
            <LexLogo size="md" />
          </div>

          <AnimatePresence mode="wait">
            {mode === "email-sent" ? (
              <motion.div
                key="email-sent"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <div className="flex justify-center mb-6">
                  <div className="h-20 w-20 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center shadow-glow-accent">
                    <MailCheck className="h-10 w-10 text-accent" />
                  </div>
                </div>
                <h2 className="text-display-lg mb-3">Verifique seu e-mail</h2>
                <p className="text-body-sm text-muted-foreground mb-2">
                  Enviamos um link de confirmação para:
                </p>
                <p className="text-body-sm text-primary font-semibold mb-6">{email}</p>
                <p className="text-caption text-muted-foreground mb-8">
                  Clique no link enviado para ativar sua conta. Verifique a caixa de spam se não encontrar o e-mail.
                </p>
                <Button variant="outline" className="w-full h-12 rounded-xl" onClick={() => setMode("login")}>
                  Voltar para o login
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-display-lg mb-1">
                  {mode === "login" ? "Bem-vindo de volta" : mode === "register" ? "Criar conta" : "Recuperar senha"}
                </h2>
                <p className="text-body-sm text-muted-foreground mb-8">
                  {mode === "login"
                    ? "Acesse sua conta LexIA"
                    : mode === "register"
                    ? "Comece a transformar sua gestão jurídica"
                    : "Enviaremos um link de recuperação"}
                </p>

                <form onSubmit={onSubmit} className="space-y-4">
                  {mode === "register" && (
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Nome completo"
                        className="pl-10 h-12 rounded-xl bg-muted border-border"
                      />
                    </div>
                  )}
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="pl-10 h-12 rounded-xl bg-muted border-border"
                      required
                    />
                  </div>
                  {mode !== "forgot" && (
                    <div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="pl-10 h-12 rounded-xl bg-muted border-border"
                          required
                          minLength={8}
                        />
                      </div>
                      {mode === "register" && <PasswordStrength password={password} />}
                    </div>
                  )}

                  {mode === "login" && isLockedOut && (
                    <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-center">
                      <p className="text-body-sm text-destructive font-medium">
                        Bloqueado por {lockoutSeconds}s
                      </p>
                      <p className="text-caption text-muted-foreground mt-1">
                        Muitas tentativas falhas. Aguarde para tentar novamente.
                      </p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="hero"
                    className="w-full h-12 rounded-xl text-base"
                    disabled={loading || (mode === "login" && isLockedOut) || (mode === "register" && !passwordValid && password.length > 0)}
                  >
                    {loading ? (
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse-glow" />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse-glow" style={{ animationDelay: "150ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse-glow" style={{ animationDelay: "300ms" }} />
                      </div>
                    ) : (
                      <>
                        {mode === "login" ? (isLockedOut ? `Aguarde ${lockoutSeconds}s` : "Entrar") : mode === "register" ? "Criar conta" : "Enviar link"}
                        {!isLockedOut && <ArrowRight className="h-4 w-4" />}
                      </>
                    )}
                  </Button>
                </form>

                {mode !== "forgot" && (
                  <>
                    <div className="flex items-center gap-3 my-5">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-caption text-muted-foreground">ou</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-12 rounded-xl text-base gap-3"
                      onClick={handleGoogleLogin}
                      disabled={loading}
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      Continuar com Google
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-12 rounded-xl text-base gap-3"
                      onClick={handleAppleLogin}
                      disabled={loading}
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                      </svg>
                      Continuar com Apple
                    </Button>
                  </>
                )}

                <div className="mt-6 text-center space-y-2">
                  {mode === "login" && (
                    <>
                      <button
                        onClick={() => setMode("forgot")}
                        className="text-body-sm text-muted-foreground hover:text-primary transition-colors block w-full"
                      >
                        Esqueceu a senha?
                      </button>
                      <p className="text-body-sm text-muted-foreground">
                        Não tem conta?{" "}
                        <button onClick={() => setMode("register")} className="text-primary font-semibold hover:underline">
                          Criar conta
                        </button>
                      </p>
                    </>
                  )}
                  {mode !== "login" && (
                    <p className="text-body-sm text-muted-foreground">
                      Já tem conta?{" "}
                      <button onClick={() => setMode("login")} className="text-primary font-semibold hover:underline">
                        Entrar
                      </button>
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Auth;
