import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { FileText, Save, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { validateCNPJ, validateCPF, formatCNPJ, formatCPF } from "@/lib/fiscal-validation";

interface Props {
  org: any;
  activeOrgId: string;
  isOwner: boolean;
}

export const OrgFiscalTab = ({ org, activeOrgId, isOwner }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [taxId, setTaxId] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [endereco, setEndereco] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [responsavelCpf, setResponsavelCpf] = useState("");

  useEffect(() => {
    if (org) {
      setTaxId(org.tax_id || "");
      setRazaoSocial(org.razao_social || "");
      setEndereco(org.endereco || "");
      setInscricaoEstadual(org.inscricao_estadual || "");
      setInscricaoMunicipal(org.inscricao_municipal || "");
      setResponsavelNome(org.responsavel_legal_nome || "");
      setResponsavelCpf(org.responsavel_legal_cpf || "");
    }
  }, [org]);

  const cnpjValid = !taxId || validateCNPJ(taxId);
  const cpfValid = !responsavelCpf || validateCPF(responsavelCpf);

  const saveFiscalMutation = useMutation({
    mutationFn: async () => {
      if (taxId && !validateCNPJ(taxId)) throw new Error("CNPJ inválido");
      if (responsavelCpf && !validateCPF(responsavelCpf)) throw new Error("CPF do responsável inválido");

      // Check CNPJ uniqueness
      if (taxId) {
        const { data: existing } = await supabase
          .from("organizations")
          .select("id")
          .eq("tax_id", taxId)
          .neq("id", activeOrgId)
          .neq("status", "deleted")
          .maybeSingle();
        if (existing) throw new Error("CNPJ já cadastrado em outra organização");
      }

      const updateData: any = {
        tax_id: taxId || null,
        razao_social: razaoSocial || null,
        endereco: endereco || null,
        inscricao_estadual: inscricaoEstadual || null,
        inscricao_municipal: inscricaoMunicipal || null,
        responsavel_legal_nome: responsavelNome || null,
        responsavel_legal_cpf: responsavelCpf || null,
      };

      const { error } = await supabase
        .from("organizations")
        .update(updateData)
        .eq("id", activeOrgId);
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        action: "organization_fiscal_updated",
        user_id: user!.id,
        organization_id: activeOrgId,
        resource_type: "organization",
        resource_id: activeOrgId,
        metadata: {
          fields_changed: Object.keys(updateData),
          user_agent: navigator.userAgent,
        },
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-details"] });
      toast.success("Dados fiscais atualizados!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isOwner) {
    return (
      <LexCard hover={false}>
        <LexCardHeader>
          <LexCardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Dados Fiscais
          </LexCardTitle>
        </LexCardHeader>
        <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
          <p className="text-body-sm text-warning font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Somente o proprietário pode editar dados fiscais.
          </p>
        </div>
        <div className="space-y-3 mt-4">
          <Field label="CNPJ" value={org?.tax_id || "Não informado"} />
          <Field label="Razão Social" value={org?.razao_social || "Não informado"} />
          <Field label="Endereço" value={org?.endereco || "Não informado"} />
          <Field label="Responsável Legal" value={org?.responsavel_legal_nome || "Não informado"} />
        </div>
      </LexCard>
    );
  }

  return (
    <LexCard hover={false}>
      <LexCardHeader>
        <LexCardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> Dados Fiscais
        </LexCardTitle>
      </LexCardHeader>
      <div className="space-y-4">
        <div>
          <label className="text-overline text-muted-foreground block mb-1.5">CNPJ</label>
          <div className="relative max-w-md">
            <Input
              className="bg-muted border-border rounded-xl pr-10"
              value={taxId}
              onChange={(e) => setTaxId(formatCNPJ(e.target.value))}
              placeholder="00.000.000/0000-00"
            />
            {taxId && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {cnpjValid ? <CheckCircle className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
              </span>
            )}
          </div>
          {taxId && !cnpjValid && <p className="text-caption text-destructive mt-1">CNPJ inválido</p>}
        </div>

        <div>
          <label className="text-overline text-muted-foreground block mb-1.5">Razão Social</label>
          <Input className="bg-muted border-border rounded-xl max-w-md" value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} placeholder="Razão social completa" />
        </div>

        <div>
          <label className="text-overline text-muted-foreground block mb-1.5">Endereço Completo</label>
          <Input className="bg-muted border-border rounded-xl max-w-md" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, cidade, estado, CEP" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
          <div>
            <label className="text-overline text-muted-foreground block mb-1.5">Inscrição Estadual</label>
            <Input className="bg-muted border-border rounded-xl" value={inscricaoEstadual} onChange={(e) => setInscricaoEstadual(e.target.value)} placeholder="Opcional" />
          </div>
          <div>
            <label className="text-overline text-muted-foreground block mb-1.5">Inscrição Municipal</label>
            <Input className="bg-muted border-border rounded-xl" value={inscricaoMunicipal} onChange={(e) => setInscricaoMunicipal(e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        <Separator />

        <h3 className="text-body-sm font-semibold">Responsável Legal</h3>

        <div>
          <label className="text-overline text-muted-foreground block mb-1.5">Nome</label>
          <Input className="bg-muted border-border rounded-xl max-w-md" value={responsavelNome} onChange={(e) => setResponsavelNome(e.target.value)} placeholder="Nome completo" />
        </div>

        <div>
          <label className="text-overline text-muted-foreground block mb-1.5">CPF</label>
          <div className="relative max-w-md">
            <Input
              className="bg-muted border-border rounded-xl pr-10"
              value={responsavelCpf}
              onChange={(e) => setResponsavelCpf(formatCPF(e.target.value))}
              placeholder="000.000.000-00"
            />
            {responsavelCpf && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {cpfValid ? <CheckCircle className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
              </span>
            )}
          </div>
          {responsavelCpf && !cpfValid && <p className="text-caption text-destructive mt-1">CPF inválido</p>}
        </div>

        <Button onClick={() => saveFiscalMutation.mutate()} disabled={saveFiscalMutation.isPending || !cnpjValid || !cpfValid}>
          <Save className="h-4 w-4" /> {saveFiscalMutation.isPending ? "Salvando..." : "Salvar Dados Fiscais"}
        </Button>
      </div>
    </LexCard>
  );
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-overline text-muted-foreground">{label}</p>
      <p className="text-body-sm">{value}</p>
    </div>
  );
}
