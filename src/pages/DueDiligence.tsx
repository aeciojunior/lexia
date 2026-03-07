import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { FileSearch, Sparkles, Loader2, AlertTriangle, Shield, DollarSign, Scale } from "lucide-react";
import ReactMarkdown from "react-markdown";

const DD_TYPES = [
  { value: "corporate", label: "Operação Societária" },
  { value: "ma", label: "Fusão / Aquisição" },
  { value: "internal_audit", label: "Auditoria Interna" },
  { value: "vendor", label: "Onboarding de Fornecedor" },
  { value: "contract_risk", label: "Risco Contratual" },
  { value: "compliance", label: "Compliance Regulatório" },
];

export default function DueDiligence() {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const [ddType, setDdType] = useState("contract_risk");
  const [targetName, setTargetName] = useState("");
  const [context, setContext] = useState("");
  const [report, setReport] = useState<string | null>(null);

  const runDueDiligence = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("due-diligence", {
        body: { type: ddType, target_name: targetName, context, organization_id: activeOrgId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.report;
    },
    onSuccess: async (data) => {
      setReport(data);
      await supabase.from("audit_logs").insert({
        action: "due_diligence_performed", user_id: user!.id,
        organization_id: activeOrgId!, resource_type: "due_diligence",
        metadata: { type: ddType, target_name: targetName },
      } as any);
      toast({ title: "Due Diligence concluída" });
    },
    onError: (e: any) => toast({ title: "Erro na Due Diligence", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="page-layout">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <FileSearch className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Due Diligence Automatizada</h1>
          <p className="text-sm text-muted-foreground">RF-078 — Análise jurídica automatizada de riscos e inconsistências</p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="section-grid">
            <div className="space-y-2">
              <Label>Tipo de Due Diligence</Label>
              <Select value={ddType} onValueChange={setDdType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Alvo da Análise</Label>
              <Input value={targetName} onChange={e => setTargetName(e.target.value)} placeholder="Nome da empresa, contrato ou parte" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Contexto e Documentos Relevantes</Label>
            <Textarea value={context} onChange={e => setContext(e.target.value)} placeholder="Descreva o contexto, cláusulas relevantes, partes envolvidas, documentos disponíveis..." rows={5} />
          </div>
          <Button onClick={() => runDueDiligence.mutate()} disabled={!targetName || runDueDiligence.isPending} className="w-full gap-2 md:w-auto">
            {runDueDiligence.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Executar Due Diligence
          </Button>
        </CardContent>
      </Card>

      {/* Checklist visual */}
      {!report && !runDueDiligence.isPending && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: AlertTriangle, label: "Riscos Jurídicos", desc: "Análise de riscos contratuais e processuais" },
            { icon: Shield, label: "Compliance", desc: "Verificação de conformidade regulatória" },
            { icon: DollarSign, label: "Impacto Financeiro", desc: "Estimativa qualitativa de exposição" },
            { icon: Scale, label: "Inconsistências", desc: "Detecção de conflitos documentais" },
          ].map((item, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-5 text-center">
                <item.icon className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {report && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileSearch className="h-5 w-5 text-primary" />
              Relatório de Due Diligence
              <Badge variant="outline">{DD_TYPES.find(t => t.value === ddType)?.label}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
