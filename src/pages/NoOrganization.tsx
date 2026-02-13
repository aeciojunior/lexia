import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LexLogo } from "@/components/lexia/LexLogo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Mail, ArrowRight, ArrowLeft, Plus, LogOut, Camera, Loader2, Zap, Crown, Shield, Clock, Check } from "lucide-react";

type View = "choice" | "create-org" | "select-plan";
type PlanOption = "free" | "trial" | "pro" | "enterprise";

const PLANS: { id: PlanOption; name: string; icon: any; price: string; desc: string; features: string[]; popular?: boolean }[] = [
  { id: "free", name: "Gratuito", icon: Zap, price: "R$ 0", desc: "Para começar", features: ["1 usuário", "10 processos", "1 GB", "IA básica"] },
  { id: "trial", name: "Trial", icon: Clock, price: "R$ 0", desc: "14 dias grátis", features: ["5 usuários", "50 processos", "5 GB", "IA completa", "Integrações"], popular: true },
  { id: "pro", name: "Profissional", icon: Crown, price: "R$ 197/mês", desc: "Para escritórios", features: ["20 usuários", "500 processos", "50 GB", "IA + Agentes", "Automações"] },
  { id: "enterprise", name: "Enterprise", icon: Shield, price: "Sob consulta", desc: "Para grandes operações", features: ["Ilimitado", "IA avançada", "SLA dedicado"] },
];

function validateCNPJ(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return false;
  if (/^(\d)\1+$/.test(clean)) return false;
  let sum = 0, weight = [5,4,3,2,9,8,7,6,5,4,3,2];
  for (let i = 0; i < 12; i++) sum += parseInt(clean[i]) * weight[i];
  let rem = sum % 11;
  if (parseInt(clean[12]) !== (rem < 2 ? 0 : 11 - rem)) return false;
  sum = 0; weight = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  for (let i = 0; i < 13; i++) sum += parseInt(clean[i]) * weight[i];
  rem = sum % 11;
  return parseInt(clean[13]) === (rem < 2 ? 0 : 11 - rem);
}

function formatCNPJ(value: string): string {
  const clean = value.replace(/\D/g, "").slice(0, 14);
  return clean.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}

const NoOrganization = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("choice");
  const [orgName, setOrgName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [endereco, setEndereco] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [responsavelCpf, setResponsavelCpf] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanOption>("trial");
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Máximo 2MB"); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleCreateOrg = async () => {
    if (!orgName.trim() || orgName.trim().length < 3) { toast.error("Nome deve ter pelo menos 3 caracteres."); return; }
    if (taxId && !validateCNPJ(taxId)) { toast.error("CNPJ inválido."); return; }

    setLoading(true);
    try {
      const trialEndsAt = selectedPlan === "trial" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null;

      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: orgName.trim(),
          tax_id: taxId.replace(/\D/g, "") || null,
          plan: selectedPlan,
          razao_social: razaoSocial.trim() || null,
          endereco: endereco.trim() || null,
          responsavel_legal_nome: responsavelNome.trim() || null,
          responsavel_legal_cpf: responsavelCpf.replace(/\D/g, "") || null,
          trial_ends_at: trialEndsAt,
        } as any)
        .select("id")
        .single();
      if (orgError) {
        if (orgError.message?.includes("idx_organizations_tax_id_unique")) {
          toast.error("CNPJ já cadastrado em outra organização.");
          setLoading(false);
          return;
        }
        throw orgError;
      }

      // Upload logo
      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const path = `${org.id}/logo.${ext}`;
        const { error: uploadError } = await supabase.storage.from("org-logos").upload(path, logoFile, { upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("org-logos").getPublicUrl(path);
          await supabase.from("organizations").update({ logo_url: urlData.publicUrl } as any).eq("id", org.id);
        }
      }

      // Link user as owner
      await supabase.from("user_organizations").insert({ user_id: user!.id, organization_id: org.id, role: "owner" });

      // Set active org
      await supabase.from("profiles").update({ active_organization_id: org.id }).eq("user_id", user!.id);

      // Create default settings
      await supabase.from("organization_settings").insert({ organization_id: org.id } as any);

      // Audit logs
      await supabase.from("audit_logs").insert([
        { action: "organization_created", user_id: user!.id, organization_id: org.id, resource_type: "organization", resource_id: org.id, metadata: { plan: selectedPlan } },
        { action: "organization_plan_selected", user_id: user!.id, organization_id: org.id, resource_type: "organization", resource_id: org.id, metadata: { plan: selectedPlan, trial_ends_at: trialEndsAt } },
      ] as any);

      if (logoFile) {
        await supabase.from("audit_logs").insert({ action: "organization_logo_uploaded", user_id: user!.id, organization_id: org.id, resource_type: "organization", resource_id: org.id } as any);
      }

      toast.success("Organização criada com sucesso!");
      navigate("/onboarding");
    } catch (err: any) {
      toast.error("Erro ao criar organização: " + (err.message || "Tente novamente."));
    }
    setLoading(false);
  };

  const handleLogout = async () => { await signOut(); navigate("/auth"); };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-10"><LexLogo size="md" /></div>

        <AnimatePresence mode="wait">
          {/* Step 1: Choice */}
          {view === "choice" && (
            <motion.div key="choice" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="text-center">
              <h2 className="text-display-lg mb-2">Bem-vindo ao LexIA!</h2>
              <p className="text-body-sm text-muted-foreground mb-8">Você ainda não pertence a nenhuma organização. Escolha como deseja começar:</p>
              <div className="space-y-3">
                <Button variant="hero" className="w-full h-14 rounded-xl text-base justify-start px-5 gap-4" onClick={() => setView("create-org")}>
                  <div className="h-10 w-10 rounded-lg bg-primary-foreground/10 flex items-center justify-center shrink-0"><Plus className="h-5 w-5" /></div>
                  <div className="text-left">
                    <span className="block font-semibold">Criar organização</span>
                    <span className="block text-[11px] opacity-80">Configure seu escritório agora</span>
                  </div>
                </Button>
                <div className="rounded-xl border border-border bg-card/50 p-5">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0"><Mail className="h-5 w-5 text-muted-foreground" /></div>
                    <div className="text-left">
                      <span className="block text-sm font-semibold text-foreground">Aguardar convite</span>
                      <span className="block text-caption text-muted-foreground mt-0.5">Se você foi convidado, verifique seu e-mail e clique no link.</span>
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={handleLogout} className="mt-8 text-body-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5">
                <LogOut className="h-3.5 w-3.5" /> Sair
              </button>
            </motion.div>
          )}

          {/* Step 2: Org details */}
          {view === "create-org" && (
            <motion.div key="create-org" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 mb-4">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span className="text-caption text-primary font-semibold">Passo 1 de 2</span>
              </div>
              <h2 className="text-display-lg mb-2">Dados da organização</h2>
              <p className="text-body-sm text-muted-foreground mb-6">Informe os dados do seu escritório. Campos com * são obrigatórios.</p>

              <div className="space-y-4">
                {/* Logo */}
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <Avatar className="h-16 w-16">
                      {logoPreview && <AvatarImage src={logoPreview} alt="Logo" />}
                      <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">{orgName ? orgName.slice(0, 2).toUpperCase() : "OG"}</AvatarFallback>
                    </Avatar>
                    <button type="button" onClick={() => logoInputRef.current?.click()} className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="h-5 w-5 text-white" />
                    </button>
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                  </div>
                  <div>
                    <p className="text-body-sm font-medium">Logo (opcional)</p>
                    <p className="text-caption text-muted-foreground">PNG/JPG, máx 2MB</p>
                  </div>
                </div>

                <div>
                  <label className="text-label text-muted-foreground mb-1.5 block">Nome do escritório *</label>
                  <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Ex: Silva & Associados" className="h-12 rounded-xl bg-muted border-border" autoFocus />
                </div>
                <div>
                  <label className="text-label text-muted-foreground mb-1.5 block">CNPJ</label>
                  <Input value={taxId} onChange={(e) => setTaxId(formatCNPJ(e.target.value))} placeholder="00.000.000/0001-00" className="h-12 rounded-xl bg-muted border-border" />
                </div>
                <div>
                  <label className="text-label text-muted-foreground mb-1.5 block">Razão social</label>
                  <Input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} placeholder="Razão social completa" className="h-12 rounded-xl bg-muted border-border" />
                </div>
                <div>
                  <label className="text-label text-muted-foreground mb-1.5 block">Endereço</label>
                  <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, cidade, UF" className="h-12 rounded-xl bg-muted border-border" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-label text-muted-foreground mb-1.5 block">Responsável legal</label>
                    <Input value={responsavelNome} onChange={(e) => setResponsavelNome(e.target.value)} placeholder="Nome completo" className="h-12 rounded-xl bg-muted border-border" />
                  </div>
                  <div>
                    <label className="text-label text-muted-foreground mb-1.5 block">CPF do responsável</label>
                    <Input value={responsavelCpf} onChange={(e) => setResponsavelCpf(e.target.value)} placeholder="000.000.000-00" className="h-12 rounded-xl bg-muted border-border" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <Button variant="outline" className="h-12 rounded-xl" onClick={() => setView("choice")}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button variant="hero" className="h-12 rounded-xl flex-1" onClick={() => { if (!orgName.trim() || orgName.trim().length < 3) { toast.error("Nome deve ter pelo menos 3 caracteres"); return; } if (taxId && !validateCNPJ(taxId)) { toast.error("CNPJ inválido"); return; } setView("select-plan"); }} disabled={!orgName.trim()}>
                  Escolher plano <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Plan selection */}
          {view === "select-plan" && (
            <motion.div key="select-plan" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 mb-4">
                <Crown className="h-3.5 w-3.5 text-primary" />
                <span className="text-caption text-primary font-semibold">Passo 2 de 2</span>
              </div>
              <h2 className="text-display-lg mb-2">Escolha seu plano</h2>
              <p className="text-body-sm text-muted-foreground mb-6">Você pode alterar o plano a qualquer momento nas configurações.</p>

              <div className="grid grid-cols-2 gap-3">
                {PLANS.map((plan) => {
                  const isSelected = selectedPlan === plan.id;
                  return (
                    <button key={plan.id} onClick={() => setSelectedPlan(plan.id)} className={`relative text-left p-4 rounded-xl border-2 transition-all ${isSelected ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card hover:border-primary/30"}`}>
                      {plan.popular && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Recomendado</span>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <plan.icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="text-sm font-semibold">{plan.name}</span>
                      </div>
                      <p className="text-xs font-bold text-foreground">{plan.price}</p>
                      <p className="text-[11px] text-muted-foreground mb-2">{plan.desc}</p>
                      <ul className="space-y-1">
                        {plan.features.map((f) => (
                          <li key={f} className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Check className="h-3 w-3 text-primary shrink-0" /> {f}
                          </li>
                        ))}
                      </ul>
                      {isSelected && <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center"><Check className="h-3 w-3 text-primary-foreground" /></div>}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3 mt-8">
                <Button variant="outline" className="h-12 rounded-xl" onClick={() => setView("create-org")}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button variant="hero" className="h-12 rounded-xl flex-1" onClick={handleCreateOrg} disabled={loading}>
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando...</> : <>Criar organização <ArrowRight className="h-4 w-4" /></>}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default NoOrganization;
