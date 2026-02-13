import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LexLogo } from "@/components/lexia/LexLogo";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, FileText, CheckCircle, ArrowRight, ArrowLeft, Sparkles, Users, Settings, UserPlus, Trash2 } from "lucide-react";

const steps = [
  { icon: Building2, title: "Revisão", desc: "Confirme os dados da organização" },
  { icon: Users, title: "Equipe", desc: "Convide membros" },
  { icon: FileText, title: "Primeiro processo", desc: "Cadastre um processo" },
  { icon: CheckCircle, title: "Tudo pronto!", desc: "Comece a usar" },
];

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 0 - Org review
  const [orgName, setOrgName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [orgLoaded, setOrgLoaded] = useState(false);

  // Step 1 - Invite
  const [invites, setInvites] = useState<{ email: string; role: string }[]>([]);
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState("user");

  // Step 2 - Process
  const [processTitle, setProcessTitle] = useState("");
  const [processNumber, setProcessNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [court, setCourt] = useState("");

  // Load org data on mount
  const loadOrg = async () => {
    if (orgLoaded) return;
    const { data: profile } = await supabase.from("profiles").select("active_organization_id").eq("user_id", user!.id).single();
    if (profile?.active_organization_id) {
      const { data: org } = await supabase.from("organizations").select("name, tax_id").eq("id", profile.active_organization_id).single();
      if (org) { setOrgName(org.name || ""); setTaxId((org as any).tax_id || ""); }
    }
    setOrgLoaded(true);
  };
  if (user && !orgLoaded) loadOrg();

  const handleOrgSetup = async () => {
    if (!orgName.trim()) { toast.error("Informe o nome do escritório"); return; }
    setLoading(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("active_organization_id").eq("user_id", user!.id).single();
      if (profile?.active_organization_id) {
        await supabase.from("organizations").update({ name: orgName, tax_id: taxId || null } as any).eq("id", profile.active_organization_id);
      }
      // Mark onboarding step
      if (profile?.active_organization_id) {
        await supabase.from("organization_settings").update({ onboarding_step: 1 } as any).eq("organization_id", profile.active_organization_id);
      }
      await supabase.from("audit_logs").insert({ action: "onboarding_step_completed", user_id: user!.id, resource_type: "onboarding", metadata: { step: 0, step_name: "org_review" } } as any);
      setStep(1);
    } catch { toast.error("Erro ao configurar organização"); }
    setLoading(false);
  };

  const addInvite = () => {
    if (!invEmail.trim() || !invEmail.includes("@")) { toast.error("E-mail inválido"); return; }
    if (invites.some(i => i.email === invEmail)) { toast.error("E-mail já adicionado"); return; }
    setInvites([...invites, { email: invEmail.trim(), role: invRole }]);
    setInvEmail("");
  };

  const handleInvites = async () => {
    setLoading(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("active_organization_id").eq("user_id", user!.id).single();
      for (const inv of invites) {
        await supabase.functions.invoke("org-invites", {
          body: { action: "send-invite", organization_id: profile?.active_organization_id, email: inv.email, role: inv.role },
        });
      }
      if (invites.length > 0) toast.success(`${invites.length} convite(s) enviado(s)!`);
      await supabase.from("audit_logs").insert({ action: "onboarding_step_completed", user_id: user!.id, resource_type: "onboarding", metadata: { step: 1, step_name: "team_invites", invites_count: invites.length } } as any);
      setStep(2);
    } catch { toast.error("Erro ao enviar convites"); }
    setLoading(false);
  };

  const handleProcessCreate = async (skip: boolean) => {
    if (skip) { setStep(3); return; }
    if (!processTitle.trim() || !processNumber.trim() || !clientName.trim()) { toast.error("Preencha os campos obrigatórios"); return; }
    setLoading(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("active_organization_id").eq("user_id", user!.id).single();
      await supabase.from("processes").insert({ title: processTitle, number: processNumber, client_name: clientName, court: court || null, user_id: user!.id, organization_id: profile?.active_organization_id });
      await supabase.from("audit_logs").insert({ action: "onboarding_step_completed", user_id: user!.id, resource_type: "onboarding", metadata: { step: 2, step_name: "first_process" } } as any);
      setStep(3);
    } catch { toast.error("Erro ao criar processo"); }
    setLoading(false);
  };

  const finish = async () => {
    const { data: profile } = await supabase.from("profiles").select("active_organization_id").eq("user_id", user!.id).single();
    if (profile?.active_organization_id) {
      await supabase.from("organization_settings").update({ onboarding_completed: true, onboarding_step: 4 } as any).eq("organization_id", profile.active_organization_id);
    }
    await supabase.from("audit_logs").insert({ action: "onboarding_completed", user_id: user!.id, resource_type: "onboarding" } as any);
    navigate("/dashboard");
  };

  const roleLabels: Record<string, string> = { user: "Usuário", admin: "Admin", intern: "Estagiário" };

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
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all ${i < step ? "bg-accent text-accent-foreground" : i === step ? "bg-primary text-primary-foreground shadow-glow-primary" : "bg-muted text-muted-foreground"}`}>
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
          <div className="lg:hidden mb-8 flex justify-center"><LexLogo size="sm" /></div>
          <div className="lg:hidden flex gap-2 mb-8 justify-center">
            {steps.map((_, i) => (<div key={i} className={`h-1.5 rounded-full transition-all ${i <= step ? "w-8 bg-primary" : "w-4 bg-muted"}`} />))}
          </div>

          <AnimatePresence mode="wait">
            {/* Step 0: Org Review */}
            {step === 0 && (
              <motion.div key="org" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 mb-4">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  <span className="text-caption text-primary font-semibold">Passo 1</span>
                </div>
                <h2 className="text-display-lg mb-2">Confirme seu escritório</h2>
                <p className="text-body-sm text-muted-foreground mb-8">Revise e ajuste os dados da organização.</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-label text-muted-foreground mb-1.5 block">Nome *</label>
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

            {/* Step 1: Team Invites */}
            {step === 1 && (
              <motion.div key="team" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <div className="inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-secondary/5 px-3 py-1 mb-4">
                  <Users className="h-3.5 w-3.5 text-secondary" />
                  <span className="text-caption text-secondary font-semibold">Passo 2</span>
                </div>
                <h2 className="text-display-lg mb-2">Convide sua equipe</h2>
                <p className="text-body-sm text-muted-foreground mb-6">Opcional — adicione membros agora ou depois.</p>

                <div className="flex gap-2 mb-4">
                  <Input value={invEmail} onChange={(e) => setInvEmail(e.target.value)} placeholder="email@escritorio.com" className="h-10 rounded-xl bg-muted border-border flex-1" onKeyDown={(e) => e.key === "Enter" && addInvite()} />
                  <Select value={invRole} onValueChange={setInvRole}>
                    <SelectTrigger className="w-28 h-10 rounded-xl bg-muted border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">Usuário</SelectItem>
                      <SelectItem value="intern">Estagiário</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl shrink-0" onClick={addInvite}><UserPlus className="h-4 w-4" /></Button>
                </div>

                {invites.length > 0 && (
                  <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                    {invites.map((inv, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border">
                        <div>
                          <p className="text-body-sm font-medium">{inv.email}</p>
                          <p className="text-caption text-muted-foreground">{roleLabels[inv.role]}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setInvites(invites.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-3 mt-8">
                  <Button variant="outline" className="h-12 rounded-xl" onClick={() => setStep(0)}><ArrowLeft className="h-4 w-4" /></Button>
                  <Button variant="ghost" className="h-12 rounded-xl flex-1" onClick={() => { setStep(2); }}>Pular</Button>
                  <Button variant="hero" className="h-12 rounded-xl flex-1" onClick={handleInvites} disabled={loading}>
                    {invites.length > 0 ? `Enviar ${invites.length} convite(s)` : "Continuar"} <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 2: First Process */}
            {step === 2 && (
              <motion.div key="process" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 mb-4">
                  <FileText className="h-3.5 w-3.5 text-accent" />
                  <span className="text-caption text-accent font-semibold">Passo 3</span>
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
                  <Button variant="outline" className="h-12 rounded-xl" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4" /></Button>
                  <Button variant="ghost" className="h-12 rounded-xl flex-1" onClick={() => handleProcessCreate(true)}>Pular</Button>
                  <Button variant="hero" className="h-12 rounded-xl flex-1" onClick={() => handleProcessCreate(false)} disabled={loading}>Cadastrar <ArrowRight className="h-4 w-4" /></Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Done */}
            {step === 3 && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="text-center">
                <div className="flex justify-center mb-6">
                  <div className="h-20 w-20 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center shadow-glow-accent">
                    <CheckCircle className="h-10 w-10 text-accent" />
                  </div>
                </div>
                <h2 className="text-display-lg mb-3">Tudo pronto!</h2>
                <p className="text-body-sm text-muted-foreground mb-2">Seu escritório está configurado e pronto para usar.</p>
                <p className="text-body-sm text-muted-foreground mb-8">Explore o dashboard, adicione processos e converse com a <span className="gradient-text font-semibold">IA jurídica</span>.</p>
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
