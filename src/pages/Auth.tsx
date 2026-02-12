import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LexLogo } from "@/components/lexia/LexLogo";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
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
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/dashboard");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast.error(error.message);
    } else {
      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      setMode("login");
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("E-mail de recuperação enviado!");
      setMode("login");
    }
  };

  const onSubmit = mode === "login" ? handleLogin : mode === "register" ? handleRegister : handleForgot;

  return (
    <div className="flex min-h-screen">
      {/* Left side - branding */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 relative"
        style={{ backgroundImage: `url(${heroImage})`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="absolute inset-0 bg-neutral-900/70" />
        <div className="relative z-10 text-center max-w-md">
          <LexLogo size="lg" className="justify-center mb-8" />
          <p className="text-body-lg text-neutral-300">
            Plataforma jurídica inteligente com IA avançada para transformar a gestão do seu escritório.
          </p>
        </div>
      </div>

      {/* Right side - form */}
      <div className="flex flex-1 flex-col justify-center items-center px-6 py-12 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex justify-center">
            <LexLogo size="md" />
          </div>

          <h2 className="text-display-md mb-2">
            {mode === "login" ? "Entrar" : mode === "register" ? "Criar conta" : "Recuperar senha"}
          </h2>
          <p className="text-body-sm text-muted-foreground mb-8">
            {mode === "login"
              ? "Acesse sua conta LexIA"
              : mode === "register"
              ? "Crie sua conta para começar"
              : "Enviaremos um link de recuperação"}
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="text-label block mb-1.5">Nome completo</label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" required />
              </div>
            )}
            <div>
              <label className="text-label block mb-1.5">E-mail</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
            </div>
            {mode !== "forgot" && (
              <div>
                <label className="text-label block mb-1.5">Senha</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Carregando..." : mode === "login" ? "Entrar" : mode === "register" ? "Criar conta" : "Enviar link"}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-2">
            {mode === "login" && (
              <>
                <button onClick={() => setMode("forgot")} className="text-body-sm text-primary hover:underline block w-full">
                  Esqueceu a senha?
                </button>
                <p className="text-body-sm text-muted-foreground">
                  Não tem conta?{" "}
                  <button onClick={() => setMode("register")} className="text-primary hover:underline">Criar conta</button>
                </p>
              </>
            )}
            {mode !== "login" && (
              <p className="text-body-sm text-muted-foreground">
                Já tem conta?{" "}
                <button onClick={() => setMode("login")} className="text-primary hover:underline">Entrar</button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
