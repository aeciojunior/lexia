import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plug, Plus, RefreshCw, Trash2, CheckCircle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PROVIDERS = [
  { value: "hubspot", label: "HubSpot", category: "crm" },
  { value: "pipedrive", label: "Pipedrive", category: "crm" },
  { value: "rdstation", label: "RD Station", category: "crm" },
  { value: "omie", label: "Omie", category: "erp" },
  { value: "contaazul", label: "Conta Azul", category: "erp" },
  { value: "clicksign", label: "Clicksign", category: "signature" },
  { value: "docusign", label: "DocuSign", category: "signature" },
  { value: "whatsapp", label: "WhatsApp Business", category: "communication" },
  { value: "smtp", label: "E-mail SMTP", category: "communication" },
  { value: "n8n", label: "n8n (Automação)", category: "automation" },
];

const CATEGORIES: Record<string, string> = {
  crm: "CRM", erp: "ERP", signature: "Assinatura Digital",
  communication: "Comunicação", automation: "Automação",
};

const STATUS_MAP: Record<string, { label: string; icon: any; color: string }> = {
  active: { label: "Ativo", icon: CheckCircle, color: "text-accent" },
  inactive: { label: "Inativo", icon: XCircle, color: "text-muted-foreground" },
  error: { label: "Erro", icon: XCircle, color: "text-destructive" },
  syncing: { label: "Sincronizando", icon: RefreshCw, color: "text-primary" },
};

export default function Integrations() {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", provider: "hubspot" });

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ["integrations", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const createIntegration = useMutation({
    mutationFn: async () => {
      const prov = PROVIDERS.find((p) => p.value === form.provider);
      const { error } = await supabase.from("integrations").insert({
        organization_id: activeOrgId!,
        created_by: user!.id,
        name: form.name,
        provider: form.provider,
        category: prov?.category || "crm",
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "integration_connected", user_id: user!.id, organization_id: activeOrgId!,
        resource_type: "integration", metadata: { provider: form.provider },
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      setOpen(false);
      setForm({ name: "", provider: "hubspot" });
      toast({ title: "Integração criada" });
    },
    onError: () => toast({ title: "Erro ao criar integração", variant: "destructive" }),
  });

  const deleteIntegration = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("integrations").delete().eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "integration_disconnected", user_id: user!.id, organization_id: activeOrgId!,
        resource_type: "integration", resource_id: id,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast({ title: "Integração removida" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Plug className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-display-sm text-foreground">Integrações</h1>
            <p className="text-body-sm text-muted-foreground">Conecte CRM, ERP e serviços externos</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Nova Integração</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Conectar Serviço</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: HubSpot Produção" />
              </div>
              <div>
                <Label>Provedor</Label>
                <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label} ({CATEGORIES[p.category]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => createIntegration.mutate()} disabled={!form.name || createIntegration.isPending} className="w-full">
                Conectar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : integrations.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Plug className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Nenhuma integração configurada</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {integrations.map((i: any) => {
            const st = STATUS_MAP[i.status] || STATUS_MAP.inactive;
            const StatusIcon = st.icon;
            const provLabel = PROVIDERS.find((p) => p.value === i.provider)?.label || i.provider;
            return (
              <div key={i.id} className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <StatusIcon className={`h-5 w-5 shrink-0 ${st.color}`} />
                  <div>
                    <p className="font-medium text-foreground">{i.name}</p>
                    <div className="flex items-center gap-2 text-caption text-muted-foreground mt-0.5">
                      <Badge variant="outline">{provLabel}</Badge>
                      <Badge variant="secondary">{CATEGORIES[i.category]}</Badge>
                      {i.last_sync_at && (
                        <span>Última sync: {format(new Date(i.last_sync_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={i.status === "active" ? "default" : "secondary"}>{st.label}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => deleteIntegration.mutate(i.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
