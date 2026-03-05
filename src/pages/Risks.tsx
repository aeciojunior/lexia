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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Plus, AlertTriangle, ShieldAlert, TrendingDown, CheckCircle2, Sparkles, Clock } from "lucide-react";
import { format } from "date-fns";

const RISK_TYPES = [
  { value: "legal", label: "Jurídico" },
  { value: "operational", label: "Operacional" },
  { value: "financial", label: "Financeiro" },
  { value: "procedural", label: "Processual" },
  { value: "probatory", label: "Probatório" },
  { value: "merit", label: "Mérito" },
  { value: "contractual", label: "Contratual" },
  { value: "regulatory", label: "Regulatório" },
  { value: "legislative", label: "Legislativo" },
  { value: "strategic", label: "Estratégico" },
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
  const [cause, setCause] = useState("");

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
        description: description || null,
        risk_type: riskType,
        probability,
        impact,
        risk_level: riskLevel,
        mitigation_plan: mitigation || null,
        created_by: user!.id,
      } as any);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "legal_risk_detected",
        user_id: user!.id,
        organization_id: activeOrgId,
        resource_type: "risk",
        metadata: { risk_type: riskType, risk_level: riskLevel, cause: cause || null },
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risks"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      setMitigation("");
      setCause("");
      toast({ title: "Risco registrado com sucesso" });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const update: any = { status };
      if (status === "closed") update.resolved_at = new Date().toISOString();
      const { error } = await supabase.from("risks").update(update).eq("id", id);
      if (error) throw error;
      const action = status === "mitigated" ? "legal_risk_mitigated" : status === "closed" ? "risk_closed" : "legal_risk_updated";
      await supabase.from("audit_logs").insert({
        action,
        user_id: user!.id,
        organization_id: activeOrgId,
        resource_type: "risk",
        resource_id: id,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risks"] });
      toast({ title: "Status atualizado" });
    },
  });

  const openRisks = risks?.filter((r: any) => r.status === "open" || r.status === "mitigating").length || 0;
  const criticalRisks = risks?.filter((r: any) => r.risk_level === "critical" || r.risk_level === "high").length || 0;
  const mitigatedRisks = risks?.filter((r: any) => r.status === "mitigated" || r.status === "closed").length || 0;

  // Group by type for analysis
  const byType: Record<string, any[]> = {};
  risks?.forEach((r: any) => {
    const type = r.risk_type || "legal";
    if (!byType[type]) byType[type] = [];
    byType[type].push(r);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Riscos Jurídicos</h1>
          <p className="text-muted-foreground">RF-063 — Identifique, classifique, monitore e mitigue riscos</p>
        </div>
        <RoleGuard permissions={["MANAGE_RISKS"]}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Risco</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Registrar Risco</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
                <Textarea placeholder="Descrição detalhada" value={description} onChange={(e) => setDescription(e.target.value)} />
                <Input placeholder="Causa do risco" value={cause} onChange={(e) => setCause(e.target.value)} />
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

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="by-type">Por Tipo</TabsTrigger>
          <TabsTrigger value="timeline">Linha do Tempo</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card><CardContent className="pt-6 text-center"><ShieldAlert className="h-8 w-8 mx-auto text-destructive mb-2" /><p className="text-2xl font-bold">{openRisks}</p><p className="text-sm text-muted-foreground">Riscos Abertos</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-2" /><p className="text-2xl font-bold">{criticalRisks}</p><p className="text-sm text-muted-foreground">Alto/Crítico</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><TrendingDown className="h-8 w-8 mx-auto text-primary mb-2" /><p className="text-2xl font-bold">{mitigatedRisks}</p><p className="text-sm text-muted-foreground">Mitigados/Fechados</p></CardContent></Card>
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
                    <TableCell><Badge variant="outline">{RISK_TYPES.find((t) => t.value === risk.risk_type)?.label || risk.risk_type}</Badge></TableCell>
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
        </TabsContent>

        <TabsContent value="by-type">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(byType).length === 0 && (
              <Card className="col-span-full"><CardContent className="py-8 text-center text-muted-foreground">Sem riscos para análise por tipo.</CardContent></Card>
            )}
            {Object.entries(byType).sort((a, b) => b[1].length - a[1].length).map(([type, items]) => {
              const critical = items.filter((r) => r.risk_level === "critical" || r.risk_level === "high").length;
              return (
                <Card key={type}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>{RISK_TYPES.find((t) => t.value === type)?.label || type}</span>
                      <Badge variant="outline">{items.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {critical > 0 && <p className="text-xs text-destructive font-medium mb-2">⚠ {critical} alto/crítico</p>}
                    <div className="space-y-1">
                      {items.slice(0, 4).map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between text-sm">
                          <span className="truncate max-w-[180px]">{r.title}</span>
                          <Badge variant={LEVELS.find((l) => l.value === r.risk_level)?.color as any} className="text-xs">
                            {LEVELS.find((l) => l.value === r.risk_level)?.label}
                          </Badge>
                        </div>
                      ))}
                      {items.length > 4 && <p className="text-xs text-muted-foreground">+{items.length - 4} mais</p>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardContent className="pt-6">
              {(!risks || risks.length === 0) && <p className="text-center text-muted-foreground">Sem riscos para exibir na linha do tempo.</p>}
              <div className="space-y-4">
                {risks?.slice(0, 20).map((risk: any) => (
                  <div key={risk.id} className="flex gap-4 items-start">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${risk.risk_level === "critical" || risk.risk_level === "high" ? "bg-destructive" : "bg-primary"}`} />
                      <div className="w-px h-full bg-border min-h-[40px]" />
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{risk.title}</span>
                        <Badge variant={LEVELS.find((l) => l.value === risk.risk_level)?.color as any} className="text-xs">
                          {LEVELS.find((l) => l.value === risk.risk_level)?.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {RISK_TYPES.find((t) => t.value === risk.risk_type)?.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" /> {format(new Date(risk.created_at), "dd/MM/yyyy HH:mm")}
                        {risk.resolved_at && <span className="ml-2">→ Resolvido em {format(new Date(risk.resolved_at), "dd/MM/yyyy")}</span>}
                      </p>
                      {risk.description && <p className="text-xs text-muted-foreground mt-1">{risk.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Risks;
