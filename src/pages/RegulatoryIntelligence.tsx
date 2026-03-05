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
import { Plus, ShieldCheck, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const AGENCIES = [
  { value: "ANVISA", label: "ANVISA" },
  { value: "ANEEL", label: "ANEEL" },
  { value: "ANATEL", label: "ANATEL" },
  { value: "BACEN", label: "BACEN" },
  { value: "CVM", label: "CVM" },
  { value: "SUSEP", label: "SUSEP" },
  { value: "ANTT", label: "ANTT" },
  { value: "ANTAQ", label: "ANTAQ" },
  { value: "ANAC", label: "ANAC" },
  { value: "OTHER", label: "Outro" },
];

const CHANGE_TYPES = [
  { value: "creation", label: "Criação" },
  { value: "revocation", label: "Revogação" },
  { value: "partial_change", label: "Alteração Parcial" },
  { value: "full_change", label: "Alteração Total" },
];

const urgencyBadge = (u: string) => {
  const map: Record<string, { label: string; variant: "destructive" | "default" | "secondary" }> = {
    high: { label: "Alta", variant: "destructive" },
    medium: { label: "Média", variant: "default" },
    low: { label: "Baixa", variant: "secondary" },
  };
  const r = map[u] || map.medium;
  return <Badge variant={r.variant}>{r.label}</Badge>;
};

const RegulatoryIntelligence = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [agency, setAgency] = useState("ANVISA");
  const [normId, setNormId] = useState("");
  const [normTitle, setNormTitle] = useState("");
  const [changeType, setChangeType] = useState("creation");
  const [summary, setSummary] = useState("");
  const [sectors, setSectors] = useState("");
  const [urgency, setUrgency] = useState("medium");
  const [recommendations, setRecommendations] = useState("");

  const { data: updates, isLoading } = useQuery({
    queryKey: ["regulatory-updates", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("regulatory_updates")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const createUpdate = useMutation({
    mutationFn: async () => {
      const affectedSectors = sectors.split(",").map((s) => s.trim()).filter(Boolean);
      const { error } = await supabase.from("regulatory_updates").insert({
        organization_id: activeOrgId!,
        created_by: user!.id,
        agency,
        norm_identifier: normId,
        norm_title: normTitle,
        change_type: changeType,
        summary: summary || null,
        affected_sectors: affectedSectors,
        urgency,
        recommendations: recommendations || null,
      } as any);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "regulatory_update_detected",
        user_id: user!.id,
        organization_id: activeOrgId,
        resource_type: "regulatory_update",
        metadata: { agency, norm_identifier: normId },
      } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["regulatory-updates"] });
      setOpen(false);
      setNormId("");
      setNormTitle("");
      setSummary("");
      setSectors("");
      setRecommendations("");
      toast({ title: "Atualização regulatória registrada" });
    },
  });

  // Group by agency
  const byAgency: Record<string, number> = {};
  updates?.forEach((u: any) => { byAgency[u.agency] = (byAgency[u.agency] || 0) + 1; });
  const highUrgency = updates?.filter((u: any) => u.urgency === "high").length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Inteligência Regulatória
          </h1>
          <p className="text-muted-foreground">RF-065 — Monitore normas regulatórias e identifique impactos</p>
        </div>
        <RoleGuard permissions={["MANAGE_REGULATORY"]}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Atualização</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Registrar Atualização Regulatória</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Select value={agency} onValueChange={setAgency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{AGENCIES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Identificador da norma" value={normId} onChange={(e) => setNormId(e.target.value)} />
                <Input placeholder="Título da norma" value={normTitle} onChange={(e) => setNormTitle(e.target.value)} />
                <Select value={changeType} onValueChange={setChangeType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CHANGE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
                <Textarea placeholder="Resumo" value={summary} onChange={(e) => setSummary(e.target.value)} />
                <Input placeholder="Setores afetados (separados por vírgula)" value={sectors} onChange={(e) => setSectors(e.target.value)} />
                <Select value={urgency} onValueChange={setUrgency}>
                  <SelectTrigger><SelectValue placeholder="Urgência" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea placeholder="Recomendações" value={recommendations} onChange={(e) => setRecommendations(e.target.value)} />
                <Button onClick={() => createUpdate.mutate()} disabled={!normId || !normTitle}>Registrar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </RoleGuard>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6 text-center"><ShieldCheck className="h-8 w-8 mx-auto text-primary mb-2" /><p className="text-2xl font-bold">{updates?.length || 0}</p><p className="text-sm text-muted-foreground">Normas Monitoradas</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-2" /><p className="text-2xl font-bold">{highUrgency}</p><p className="text-sm text-muted-foreground">Urgência Alta</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><ShieldCheck className="h-8 w-8 mx-auto text-primary mb-2" /><p className="text-2xl font-bold">{Object.keys(byAgency).length}</p><p className="text-sm text-muted-foreground">Agências</p></CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agência</TableHead>
              <TableHead>Norma</TableHead>
              <TableHead>Alteração</TableHead>
              <TableHead>Setores</TableHead>
              <TableHead>Urgência</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6}>Carregando...</TableCell></TableRow>}
            {updates?.map((u: any) => (
              <TableRow key={u.id}>
                <TableCell><Badge variant="outline">{u.agency}</Badge></TableCell>
                <TableCell>
                  <div><p className="font-medium text-sm">{u.norm_title}</p><p className="text-xs text-muted-foreground">{u.norm_identifier}</p></div>
                </TableCell>
                <TableCell><Badge variant="secondary">{CHANGE_TYPES.find((t) => t.value === u.change_type)?.label}</Badge></TableCell>
                <TableCell><div className="flex flex-wrap gap-1">{(u.affected_sectors || []).map((s: string) => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}</div></TableCell>
                <TableCell>{urgencyBadge(u.urgency)}</TableCell>
                <TableCell className="text-sm">{format(new Date(u.created_at), "dd/MM/yyyy")}</TableCell>
              </TableRow>
            ))}
            {!isLoading && updates?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma atualização regulatória.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default RegulatoryIntelligence;
