import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LexLogo } from "@/components/lexia/LexLogo";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Mail, ArrowRight, Plus, LogOut } from "lucide-react";

type View = "choice" | "create-org";

const NoOrganization = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("choice");
  const [orgName, setOrgName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateOrg = async () => {
    if (!orgName.trim()) {
      toast.error("Informe o nome da organização.");
      return;
    }
    setLoading(true);
    try {
      // Create organization
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({ name: orgName.trim(), tax_id: taxId.trim() || null })
        .select("id")
        .single();
      if (orgError) throw orgError;

      // Link user as owner
      const { error: linkError } = await supabase
        .from("user_organizations")
        .insert({ user_id: user!.id, organization_id: org.id, role: "owner" });
      if (linkError) throw linkError;

      // Set as active org
      await supabase
        .from("profiles")
        .update({ active_organization_id: org.id })
        .eq("user_id", user!.id);

      // Audit log
      await supabase.from("audit_logs").insert({
        action: "organization_created",
        user_id: user!.id,
        organization_id: org.id,
        resource_type: "organization",
        resource_id: org.id,
      } as any);

      toast.success("Organização criada com sucesso!");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error("Erro ao criar organização: " + (err.message || "Tente novamente."));
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-10">
          <LexLogo size="md" />
        </div>

        <AnimatePresence mode="wait">
          {view === "choice" && (
            <motion.div
              key="choice"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <h2 className="text-display-lg mb-2">Bem-vindo ao LexIA!</h2>
              <p className="text-body-sm text-muted-foreground mb-8">
                Você ainda não pertence a nenhuma organização. Escolha como deseja começar:
              </p>

              <div className="space-y-3">
                <Button
                  variant="hero"
                  className="w-full h-14 rounded-xl text-base justify-start px-5 gap-4"
                  onClick={() => setView("create-org")}
                >
                  <div className="h-10 w-10 rounded-lg bg-primary-foreground/10 flex items-center justify-center shrink-0">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <span className="block font-semibold">Criar organização</span>
                    <span className="block text-[11px] opacity-80">Configure seu escritório agora</span>
                  </div>
                </Button>

                <div className="rounded-xl border border-border bg-card/50 p-5">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="text-left">
                      <span className="block text-sm font-semibold text-foreground">Aguardar convite</span>
                      <span className="block text-caption text-muted-foreground mt-0.5">
                        Se você foi convidado para uma organização, verifique seu e-mail e clique no link de convite.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="mt-8 text-body-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
              >
                <LogOut className="h-3.5 w-3.5" /> Sair
              </button>
            </motion.div>
          )}

          {view === "create-org" && (
            <motion.div
              key="create-org"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 mb-4">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span className="text-caption text-primary font-semibold">Nova organização</span>
              </div>

              <h2 className="text-display-lg mb-2">Configure seu escritório</h2>
              <p className="text-body-sm text-muted-foreground mb-8">
                Você será o <strong>Owner</strong> desta organização e poderá convidar outros membros.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-label text-muted-foreground mb-1.5 block">Nome do escritório *</label>
                  <Input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Ex: Silva & Associados"
                    className="h-12 rounded-xl bg-muted border-border"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-label text-muted-foreground mb-1.5 block">CNPJ (opcional)</label>
                  <Input
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className="h-12 rounded-xl bg-muted border-border"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <Button variant="outline" className="h-12 rounded-xl" onClick={() => setView("choice")}>
                  Voltar
                </Button>
                <Button
                  variant="hero"
                  className="h-12 rounded-xl flex-1"
                  onClick={handleCreateOrg}
                  disabled={loading || !orgName.trim()}
                >
                  {loading ? "Criando..." : "Criar organização"}
                  <ArrowRight className="h-4 w-4" />
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
