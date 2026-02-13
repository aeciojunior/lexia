import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { RoleGuard } from "@/components/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, AlertTriangle, ShieldAlert, TrendingDown, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

const RISK_TYPES = [
  { value: "legal", label: "Jurídico" },
  { value: "operational", label: "Operacional" },
  { value: "financial", label: "Financeiro" },
];

const LEVELS = [
  { value: "low", label: "Baixo", color: "secondary" },
  { value: "medium", label: "Médio", color: "default" },
  { value: "high", label: "Alto", color: "destructive" },
  { value: "critical", label: "Crítico", color: "destructive" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "Aberto" },
  { value: "mitigating", label: "Mitigando" },
  { value: "mitigated", label: "Mitigado" },
  { value: "closed", label: "Fechado" },
];

const Risks = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [riskType, setRiskType] = useState("legal");
  const [probability, setProbability] = useState("medium");
  const [impact, setImpact] = useState("medium");
  const [mitigation, setMitigation] = useState("");

  const { data: risks, isLoading } = useQuery({
    queryKey: ["risks", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risks")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const calcRiskLevel = (prob: string, imp: string): string => {
    const vals: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
    const score = (vals[prob] || 2) * (vals[imp] || 2);
    if (score >= 9) return "critical";
    if (score >= 6) return "high";
    if (score >= 3) return "medium";
    return "low";
  };

  const createRisk = useMutation({
    mutationFn: async () => {
      const riskLevel = calcRiskLevel(probability, impact);
      const { error } = await supabase.from("risks").insert({
        organization_id: activeOrgId!,
        title,
        description,
        risk_type: riskType,
        probability,
        impact,
        risk_level: riskLevel,
        mitigation_plan: mitigation || null,
        created_by: user!.id,
      } as any);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "risk_created", user_id: user!.id, organization_id: activeOrgId, resource_type: "risk",
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risks"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      setMitigation("");
      toast({ title: "Risco registrado com sucesso" });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const update: any = { status };
      if (status === "closed") update.resolved_at = new Date().toISOString();
      const { error } = await supabase.from("risks").update(update).eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: status === "mitigated" ? "risk_mitigated" : status === "closed" ? "risk_closed" : "risk_updated",
        user_id: user!.id, organization_id: activeOrgId, resource_type: "risk", resource_id: id,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risks"] });
      toast({ title: "Status atualizado" });
    },
  });

  const openRisks = risks?.filter((r: any) => r.status === "open" || r.status === "mitigating").length || 0;
  const criticalRisks = risks?.filter((r: any) => r.risk_level === "critical" || r.risk_level === "high").length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Riscos</h1>
          <p className="text-muted-foreground">Identifique, classifique e mitigue riscos</p>
        </div>
        <RoleGuard permissions={["MANAGE_RISKS"]}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Risco</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar Risco</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
                <Textarea placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} />
                <Select value={riskType} onValueChange={setRiskType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RISK_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={probability} onValueChange={setProbability}>
                    <SelectTrigger><SelectValue placeholder="Probabilidade" /></SelectTrigger>
                    <SelectContent>{LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={impact} onValueChange={setImpact}>
                    <SelectTrigger><SelectValue placeholder="Impacto" /></SelectTrigger>
                    <SelectContent>{LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Textarea placeholder="Plano de mitigação (opcional)" value={mitigation} onChange={(e) => setMitigation(e.target.value)} />
                <Button onClick={() => createRisk.mutate()} disabled={!title}>Registrar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </RoleGuard>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6 text-center"><ShieldAlert className="h-8 w-8 mx-auto text-destructive mb-2" /><p className="text-2xl font-bold">{openRisks}</p><p className="text-sm text-muted-foreground">Riscos Abertos</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-2" /><p className="text-2xl font-bold">{criticalRisks}</p><p className="text-sm text-muted-foreground">Alto/Crítico</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><TrendingDown className="h-8 w-8 mx-auto text-primary mb-2" /><p className="text-2xl font-bold">{risks?.filter((r: any) => r.status === "mitigated" || r.status === "closed").length || 0}</p><p className="text-sm text-muted-foreground">Mitigados/Fechados</p></CardContent></Card>
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Risco</TableHead><TableHead>Tipo</TableHead><TableHead>Nível</TableHead><TableHead>Status</TableHead><TableHead>Data</TableHead><TableHead>Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6}>Carregando...</TableCell></TableRow>}
            {risks?.map((risk: any) => (
              <TableRow key={risk.id}>
                <TableCell>
                  <div><p className="font-medium">{risk.title}</p>{risk.description && <p className="text-xs text-muted-foreground truncate max-w-xs">{risk.description}</p>}</div>
                </TableCell>
                <TableCell><Badge variant="outline">{RISK_TYPES.find((t) => t.value === risk.risk_type)?.label}</Badge></TableCell>
                <TableCell><Badge variant={LEVELS.find((l) => l.value === risk.risk_level)?.color as any}>{LEVELS.find((l) => l.value === risk.risk_level)?.label}</Badge></TableCell>
                <TableCell><Badge variant={risk.status === "closed" ? "secondary" : "outline"}>{STATUS_OPTIONS.find((s) => s.value === risk.status)?.label}</Badge></TableCell>
                <TableCell className="text-sm">{format(new Date(risk.created_at), "dd/MM/yyyy")}</TableCell>
                <TableCell>
                  <RoleGuard permissions={["MANAGE_RISKS"]}>
                    {risk.status !== "closed" && (
                      <Select value={risk.status} onValueChange={(v) => updateStatus.mutate({ id: risk.id, status: v })}>
                        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                  </RoleGuard>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && risks?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum risco registrado.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default Risks;
