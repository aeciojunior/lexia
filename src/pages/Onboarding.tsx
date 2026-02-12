import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LexLogo } from "@/components/lexia/LexLogo";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, FileText, CheckCircle, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";

const steps = [
  { icon: Building2, title: "Seu escritório", desc: "Configure sua organização" },
  { icon: FileText, title: "Primeiro processo", desc: "Cadastre um processo" },
  { icon: CheckCircle, title: "Tudo pronto!", desc: "Comece a usar" },
];

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1 - Organization
  const [orgName, setOrgName] = useState("");
  const [taxId, setTaxId] = useState("");

  // Step 2 - Process
  const [processTitle, setProcessTitle] = useState("");
  const [processNumber, setProcessNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [court, setCourt] = useState("");
  const [skipProcess, setSkipProcess] = useState(false);

  const handleOrgSetup = async () => {
    if (!orgName.trim()) { toast.error("Informe o nome do escritório"); return; }
    setLoading(true);
    try {
      // Get user's current org (auto-created on signup)
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_organization_id")
        .eq("user_id", user!.id)
        .single();

      if (profile?.active_organization_id) {
        await supabase
          .from("organizations")
          .update({ name: orgName, tax_id: taxId || null })
          .eq("id", profile.active_organization_id);
      }
      setStep(1);
    } catch (err: any) {
      toast.error("Erro ao configurar organização");
    }
    setLoading(false);
  };

  const handleProcessCreate = async () => {
    if (skipProcess) { setStep(2); return; }
    if (!processTitle.trim() || !processNumber.trim() || !clientName.trim()) {
      toast.error("Preencha os campos obrigatórios"); return;
    }
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_organization_id")
        .eq("user_id", user!.id)
        .single();

      await supabase.from("processes").insert({
        title: processTitle,
        number: processNumber,
        client_name: clientName,
        court: court || null,
        user_id: user!.id,
        organization_id: profile?.active_organization_id,
      });
      setStep(2);
    } catch {
      toast.error("Erro ao criar processo");
    }
    setLoading(false);
  };

  const finish = () => navigate("/dashboard");

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left - progress */}
      <div className="hidden lg:flex w-80 flex-col p-8 border-r border-border relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
        <div className="absolute inset-0 dot-grid opacity-10" />
        <div className="relative z-10 flex flex-col h-full">
          <LexLogo size="md" className="mb-12" />
          <div className="space-y-6 flex-1">
            {steps.map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all ${
                  i < step ? "bg-accent text-accent-foreground" :
                  i === step ? "bg-primary text-primary-foreground shadow-glow-primary" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {i < step ? <CheckCircle className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                </div>
                <div>
                  <p className={`text-body-sm font-semibold ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>{s.title}</p>
                  <p className="text-caption text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-caption text-muted-foreground">Passo {step + 1} de {steps.length}</p>
        </div>
      </div>

      {/* Right - content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex justify-center"><LexLogo size="sm" /></div>

          {/* Mobile step indicator */}
          <div className="lg:hidden flex gap-2 mb-8 justify-center">
            {steps.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${
                i <= step ? "w-8 bg-primary" : "w-4 bg-muted"
              }`} />
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* Step 0: Organization */}
            {step === 0 && (
              <motion.div key="org" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 mb-4">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  <span className="text-caption text-primary font-semibold">Passo 1</span>
                </div>
                <h2 className="text-display-lg mb-2">Configure seu escritório</h2>
                <p className="text-body-sm text-muted-foreground mb-8">Personalize o nome e CNPJ da sua organização.</p>

                <div className="space-y-4">
                  <div>
                    <label className="text-label text-muted-foreground mb-1.5 block">Nome do escritório *</label>
                    <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Ex: Silva & Associados" className="h-12 rounded-xl bg-muted border-border" />
                  </div>
                  <div>
                    <label className="text-label text-muted-foreground mb-1.5 block">CNPJ (opcional)</label>
                    <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="00.000.000/0001-00" className="h-12 rounded-xl bg-muted border-border" />
                  </div>
                </div>

                <Button variant="hero" className="w-full h-12 rounded-xl mt-8" onClick={handleOrgSetup} disabled={loading}>
                  Continuar <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            )}

            {/* Step 1: First Process */}
            {step === 1 && (
              <motion.div key="process" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <div className="inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-secondary/5 px-3 py-1 mb-4">
                  <FileText className="h-3.5 w-3.5 text-secondary" />
                  <span className="text-caption text-secondary font-semibold">Passo 2</span>
                </div>
                <h2 className="text-display-lg mb-2">Cadastre seu primeiro processo</h2>
                <p className="text-body-sm text-muted-foreground mb-8">Opcional — você pode fazer isso depois.</p>

                <div className="space-y-4">
                  <div>
                    <label className="text-label text-muted-foreground mb-1.5 block">Título *</label>
                    <Input value={processTitle} onChange={(e) => setProcessTitle(e.target.value)} placeholder="Ex: Ação de Cobrança" className="h-12 rounded-xl bg-muted border-border" />
                  </div>
                  <div>
                    <label className="text-label text-muted-foreground mb-1.5 block">Número do processo *</label>
                    <Input value={processNumber} onChange={(e) => setProcessNumber(e.target.value)} placeholder="0000000-00.0000.0.00.0000" className="h-12 rounded-xl bg-muted border-border" />
                  </div>
                  <div>
                    <label className="text-label text-muted-foreground mb-1.5 block">Nome do cliente *</label>
                    <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome completo" className="h-12 rounded-xl bg-muted border-border" />
                  </div>
                  <div>
                    <label className="text-label text-muted-foreground mb-1.5 block">Tribunal (opcional)</label>
                    <Input value={court} onChange={(e) => setCourt(e.target.value)} placeholder="Ex: TJSP — 3ª Vara Cível" className="h-12 rounded-xl bg-muted border-border" />
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <Button variant="outline" className="h-12 rounded-xl" onClick={() => setStep(0)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" className="h-12 rounded-xl flex-1" onClick={() => { setSkipProcess(true); setStep(2); }}>
                    Pular
                  </Button>
                  <Button variant="hero" className="h-12 rounded-xl flex-1" onClick={handleProcessCreate} disabled={loading}>
                    Cadastrar <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Done */}
            {step === 2 && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="text-center">
                <div className="flex justify-center mb-6">
                  <div className="h-20 w-20 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center shadow-glow-accent">
                    <CheckCircle className="h-10 w-10 text-accent" />
                  </div>
                </div>
                <h2 className="text-display-lg mb-3">Tudo pronto!</h2>
                <p className="text-body-sm text-muted-foreground mb-2">Seu escritório está configurado e pronto para usar.</p>
                <p className="text-body-sm text-muted-foreground mb-8">
                  Explore o dashboard, adicione processos e converse com a <span className="gradient-text font-semibold">IA jurídica</span>.
                </p>
                <Button variant="hero" size="xl" onClick={finish} className="rounded-xl">
                  <Sparkles className="h-4 w-4" /> Ir para o Dashboard
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
