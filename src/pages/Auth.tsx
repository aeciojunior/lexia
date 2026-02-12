import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LexLogo } from "@/components/lexia/LexLogo";
import { useNavigate } from "react-router-dom";
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
  { label: "Caractere especial", test: (pw) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]/.test(pw) },
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

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const passwordValid = useMemo(() => {
    return PASSWORD_CHECKS.every((c) => c.test(password));
  }, [password]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else navigate("/dashboard");
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("E-mail de recuperação enviado!");
      setMode("login");
    }
  };

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

                  <Button
                    type="submit"
                    variant="hero"
                    className="w-full h-12 rounded-xl text-base"
                    disabled={loading || (mode === "register" && !passwordValid && password.length > 0)}
                  >
                    {loading ? (
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse-glow" />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse-glow" style={{ animationDelay: "150ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse-glow" style={{ animationDelay: "300ms" }} />
                      </div>
                    ) : (
                      <>
                        {mode === "login" ? "Entrar" : mode === "register" ? "Criar conta" : "Enviar link"}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>

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
