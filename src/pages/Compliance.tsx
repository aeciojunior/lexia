import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Shield, Plus, FileText, Users, AlertTriangle, ScrollText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const POLICY_TYPES = [
  { value: "privacy", label: "Privacidade" },
  { value: "security", label: "Segurança" },
  { value: "retention", label: "Retenção" },
  { value: "access", label: "Acesso" },
];

const CONSENT_TYPES = [
  { value: "data_processing", label: "Tratamento de Dados" },
  { value: "marketing", label: "Marketing" },
  { value: "third_party", label: "Terceiros" },
];

const DSAR_TYPES = [
  { value: "access", label: "Acesso" },
  { value: "correction", label: "Correção" },
  { value: "deletion", label: "Exclusão" },
  { value: "portability", label: "Portabilidade" },
  { value: "revocation", label: "Revogação" },
];

const INCIDENT_CATEGORIES = [
  { value: "data_breach", label: "Vazamento de Dados" },
  { value: "unauthorized_access", label: "Acesso Não Autorizado" },
  { value: "data_loss", label: "Perda de Dados" },
  { value: "policy_violation", label: "Violação de Política" },
];

export default function Compliance() {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("policies");
  const [dialogOpen, setDialogOpen] = useState<string | null>(null);

  // ── Policies ──
  const [policyForm, setPolicyForm] = useState({ title: "", policy_type: "privacy", content: "" });
  const { data: policies = [] } = useQuery({
    queryKey: ["compliance-policies", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("compliance_policies").select("*").eq("organization_id", activeOrgId!).order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
    enabled: !!activeOrgId,
  });
  const createPolicy = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("compliance_policies").insert({
        organization_id: activeOrgId!, created_by: user!.id, ...policyForm,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "policy_updated", user_id: user!.id, organization_id: activeOrgId!, resource_type: "compliance_policy" } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-policies"] });
      setDialogOpen(null);
      setPolicyForm({ title: "", policy_type: "privacy", content: "" });
      toast({ title: "Política criada" });
    },
    onError: () => toast({ title: "Erro", variant: "destructive" }),
  });

  // ── Consents ──
  const [consentForm, setConsentForm] = useState({ consent_type: "data_processing", description: "" });
  const { data: consents = [] } = useQuery({
    queryKey: ["compliance-consents", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("compliance_consents").select("*").eq("organization_id", activeOrgId!).order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
    enabled: !!activeOrgId,
  });
  const createConsent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("compliance_consents").insert({
        organization_id: activeOrgId!, created_by: user!.id, ...consentForm,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "consent_recorded", user_id: user!.id, organization_id: activeOrgId!, resource_type: "consent" } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-consents"] });
      setDialogOpen(null);
      setConsentForm({ consent_type: "data_processing", description: "" });
      toast({ title: "Consentimento registrado" });
    },
    onError: () => toast({ title: "Erro", variant: "destructive" }),
  });

  // ── DSAR ──
  const [dsarForm, setDsarForm] = useState({ requester_name: "", requester_email: "", request_type: "access", description: "" });
  const { data: dsars = [] } = useQuery({
    queryKey: ["dsar-requests", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("dsar_requests").select("*").eq("organization_id", activeOrgId!).order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
    enabled: !!activeOrgId,
  });
  const createDsar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("dsar_requests").insert({
        organization_id: activeOrgId!, ...dsarForm,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "dsar_request_created", user_id: user!.id, organization_id: activeOrgId!, resource_type: "dsar" } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dsar-requests"] });
      setDialogOpen(null);
      setDsarForm({ requester_name: "", requester_email: "", request_type: "access", description: "" });
      toast({ title: "Solicitação DSAR registrada" });
    },
    onError: () => toast({ title: "Erro", variant: "destructive" }),
  });

  // ── Incidents ──
  const [incidentForm, setIncidentForm] = useState({ title: "", description: "", severity: "medium", category: "data_breach" });
  const { data: incidents = [] } = useQuery({
    queryKey: ["compliance-incidents", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("compliance_incidents").select("*").eq("organization_id", activeOrgId!).order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
    enabled: !!activeOrgId,
  });
  const createIncident = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("compliance_incidents").insert({
        organization_id: activeOrgId!, reported_by: user!.id, ...incidentForm,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "incident_reported", user_id: user!.id, organization_id: activeOrgId!, resource_type: "incident" } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-incidents"] });
      setDialogOpen(null);
      setIncidentForm({ title: "", description: "", severity: "medium", category: "data_breach" });
      toast({ title: "Incidente registrado" });
    },
    onError: () => toast({ title: "Erro", variant: "destructive" }),
  });

  const fmtDate = (d: string) => format(new Date(d), "dd/MM/yyyy", { locale: ptBR });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Shield className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-display-sm text-foreground">Compliance & LGPD</h1>
          <p className="text-body-sm text-muted-foreground">Governança de dados, consentimentos e incidentes</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="policies" className="gap-1.5"><ScrollText className="h-4 w-4" />Políticas</TabsTrigger>
          <TabsTrigger value="consents" className="gap-1.5"><Users className="h-4 w-4" />Consentimentos</TabsTrigger>
          <TabsTrigger value="dsar" className="gap-1.5"><FileText className="h-4 w-4" />DSAR</TabsTrigger>
          <TabsTrigger value="incidents" className="gap-1.5"><AlertTriangle className="h-4 w-4" />Incidentes</TabsTrigger>
        </TabsList>

        {/* ── Policies ── */}
        <TabsContent value="policies" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={dialogOpen === "policy"} onOpenChange={(o) => setDialogOpen(o ? "policy" : null)}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Nova Política</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Política</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Título</Label><Input value={policyForm.title} onChange={(e) => setPolicyForm({ ...policyForm, title: e.target.value })} /></div>
                  <div>
                    <Label>Tipo</Label>
                    <Select value={policyForm.policy_type} onValueChange={(v) => setPolicyForm({ ...policyForm, policy_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{POLICY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Conteúdo</Label><Textarea rows={5} value={policyForm.content} onChange={(e) => setPolicyForm({ ...policyForm, content: e.target.value })} /></div>
                  <Button onClick={() => createPolicy.mutate()} disabled={!policyForm.title || createPolicy.isPending} className="w-full">Criar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {policies.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nenhuma política cadastrada</div>
          ) : (
            <div className="grid gap-3">{policies.map((p: any) => (
              <div key={p.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ScrollText className="h-4 w-4 text-accent" />
                    <span className="font-medium text-foreground">{p.title}</span>
                    <Badge variant="outline">{POLICY_TYPES.find((t) => t.value === p.policy_type)?.label}</Badge>
                    <Badge variant="secondary">v{p.version}</Badge>
                  </div>
                  <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Ativa" : "Inativa"}</Badge>
                </div>
                {p.content && <p className="text-body-sm text-muted-foreground mt-2 line-clamp-2">{p.content}</p>}
              </div>
            ))}</div>
          )}
        </TabsContent>

        {/* ── Consents ── */}
        <TabsContent value="consents" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={dialogOpen === "consent"} onOpenChange={(o) => setDialogOpen(o ? "consent" : null)}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Registrar Consentimento</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Consentimento</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={consentForm.consent_type} onValueChange={(v) => setConsentForm({ ...consentForm, consent_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CONSENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Descrição</Label><Textarea value={consentForm.description} onChange={(e) => setConsentForm({ ...consentForm, description: e.target.value })} /></div>
                  <Button onClick={() => createConsent.mutate()} disabled={createConsent.isPending} className="w-full">Registrar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {consents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nenhum consentimento registrado</div>
          ) : (
            <div className="grid gap-3">{consents.map((c: any) => (
              <div key={c.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{CONSENT_TYPES.find((t) => t.value === c.consent_type)?.label}</Badge>
                    <Badge variant={c.status === "active" ? "default" : "destructive"}>{c.status === "active" ? "Ativo" : "Revogado"}</Badge>
                  </div>
                  {c.description && <p className="text-body-sm text-muted-foreground mt-1">{c.description}</p>}
                </div>
                <span className="text-caption text-muted-foreground">{fmtDate(c.created_at)}</span>
              </div>
            ))}</div>
          )}
        </TabsContent>

        {/* ── DSAR ── */}
        <TabsContent value="dsar" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={dialogOpen === "dsar"} onOpenChange={(o) => setDialogOpen(o ? "dsar" : null)}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Nova Solicitação</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Solicitação de Titular (DSAR)</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Nome do Solicitante</Label><Input value={dsarForm.requester_name} onChange={(e) => setDsarForm({ ...dsarForm, requester_name: e.target.value })} /></div>
                  <div><Label>E-mail</Label><Input type="email" value={dsarForm.requester_email} onChange={(e) => setDsarForm({ ...dsarForm, requester_email: e.target.value })} /></div>
                  <div>
                    <Label>Tipo</Label>
                    <Select value={dsarForm.request_type} onValueChange={(v) => setDsarForm({ ...dsarForm, request_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{DSAR_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Descrição</Label><Textarea value={dsarForm.description} onChange={(e) => setDsarForm({ ...dsarForm, description: e.target.value })} /></div>
                  <Button onClick={() => createDsar.mutate()} disabled={!dsarForm.requester_name || !dsarForm.requester_email || createDsar.isPending} className="w-full">Registrar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {dsars.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nenhuma solicitação DSAR</div>
          ) : (
            <div className="grid gap-3">{dsars.map((d: any) => (
              <div key={d.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{d.requester_name}</span>
                    <Badge variant="outline">{DSAR_TYPES.find((t) => t.value === d.request_type)?.label}</Badge>
                  </div>
                  <Badge variant={d.status === "pending" ? "secondary" : d.status === "completed" ? "default" : "destructive"}>{d.status}</Badge>
                </div>
                <p className="text-caption text-muted-foreground mt-1">{d.requester_email} · {fmtDate(d.created_at)}</p>
              </div>
            ))}</div>
          )}
        </TabsContent>

        {/* ── Incidents ── */}
        <TabsContent value="incidents" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={dialogOpen === "incident"} onOpenChange={(o) => setDialogOpen(o ? "incident" : null)}>
              <DialogTrigger asChild><Button variant="destructive" className="gap-2"><AlertTriangle className="h-4 w-4" />Reportar Incidente</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Incidente</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Título</Label><Input value={incidentForm.title} onChange={(e) => setIncidentForm({ ...incidentForm, title: e.target.value })} /></div>
                  <div><Label>Descrição</Label><Textarea value={incidentForm.description} onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })} /></div>
                  <div>
                    <Label>Severidade</Label>
                    <Select value={incidentForm.severity} onValueChange={(v) => setIncidentForm({ ...incidentForm, severity: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="critical">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Select value={incidentForm.category} onValueChange={(v) => setIncidentForm({ ...incidentForm, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{INCIDENT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button variant="destructive" onClick={() => createIncident.mutate()} disabled={!incidentForm.title || createIncident.isPending} className="w-full">Reportar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {incidents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nenhum incidente registrado</div>
          ) : (
            <div className="grid gap-3">{incidents.map((i: any) => {
              const sevColor: Record<string, string> = { low: "secondary", medium: "outline", high: "destructive", critical: "destructive" };
              return (
                <div key={i.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`h-4 w-4 ${i.severity === "critical" || i.severity === "high" ? "text-destructive" : "text-warning"}`} />
                      <span className="font-medium text-foreground">{i.title}</span>
                      <Badge variant={(sevColor[i.severity] || "secondary") as any}>{i.severity}</Badge>
                      <Badge variant="outline">{INCIDENT_CATEGORIES.find((c) => c.value === i.category)?.label}</Badge>
                    </div>
                    <Badge variant={i.status === "open" ? "destructive" : "default"}>{i.status === "open" ? "Aberto" : "Resolvido"}</Badge>
                  </div>
                  {i.description && <p className="text-body-sm text-muted-foreground mt-2 line-clamp-2">{i.description}</p>}
                  <p className="text-caption text-muted-foreground mt-1">{fmtDate(i.created_at)}</p>
                </div>
              );
            })}</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
