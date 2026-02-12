import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LexLogo } from "@/components/lexia/LexLogo";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Mail, Lock, User } from "lucide-react";
import heroImage from "@/assets/hero-bg.jpg";

type AuthMode = "login" | "register" | "forgot";

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Conta criada! Verifique seu e-mail."); setMode("login"); }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("E-mail de recuperação enviado!"); setMode("login"); }
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
                {mode === "login" ? "Acesse sua conta LexIA" : mode === "register" ? "Comece a transformar sua gestão jurídica" : "Enviaremos um link de recuperação"}
              </p>

              <form onSubmit={onSubmit} className="space-y-4">
                {mode === "register" && (
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome completo" className="pl-10 h-12 rounded-xl bg-muted border-border" required />
                  </div>
                )}
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="pl-10 h-12 rounded-xl bg-muted border-border" required />
                </div>
                {mode !== "forgot" && (
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-10 h-12 rounded-xl bg-muted border-border" required minLength={6} />
                  </div>
                )}
                <Button type="submit" variant="hero" className="w-full h-12 rounded-xl text-base" disabled={loading}>
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
                    <button onClick={() => setMode("forgot")} className="text-body-sm text-muted-foreground hover:text-primary transition-colors block w-full">
                      Esqueceu a senha?
                    </button>
                    <p className="text-body-sm text-muted-foreground">
                      Não tem conta?{" "}
                      <button onClick={() => setMode("register")} className="text-primary font-semibold hover:underline">Criar conta</button>
                    </p>
                  </>
                )}
                {mode !== "login" && (
                  <p className="text-body-sm text-muted-foreground">
                    Já tem conta?{" "}
                    <button onClick={() => setMode("login")} className="text-primary font-semibold hover:underline">Entrar</button>
                  </p>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Auth;
