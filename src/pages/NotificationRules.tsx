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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { BellRing, Plus, Trash2, Zap } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TRIGGER_EVENTS = [
  { value: "movement_created", label: "Nova Movimentação" },
  { value: "deadline_created", label: "Novo Prazo" },
  { value: "deadline_approaching", label: "Prazo Próximo" },
  { value: "hearing_created", label: "Audiência Criada" },
  { value: "hearing_updated", label: "Audiência Alterada" },
  { value: "document_uploaded", label: "Documento Enviado" },
  { value: "task_created", label: "Tarefa Criada" },
  { value: "task_updated", label: "Tarefa Atualizada" },
  { value: "contract_created", label: "Contrato Criado" },
  { value: "payment_registered", label: "Pagamento Registrado" },
  { value: "client_updated", label: "Cliente Atualizado" },
  { value: "ai_piece_generated", label: "Peça IA Gerada" },
  { value: "agent_completed", label: "Agente Concluiu Tarefa" },
  { value: "automation_executed", label: "Automação Executada" },
];

const CHANNELS = [
  { value: "email", label: "E-mail" },
  { value: "in_app", label: "In-App" },
  { value: "whatsapp", label: "WhatsApp" },
];

export default function NotificationRules() {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    trigger_event: "deadline_approaching",
    channels: ["email"] as string[],
    template: "",
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["notification-rules", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_rules")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const createRule = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notification_rules").insert({
        organization_id: activeOrgId!,
        created_by: user!.id,
        name: form.name,
        description: form.description || null,
        trigger_event: form.trigger_event,
        channels: form.channels,
        template: form.template || null,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "notification_rule_created", user_id: user!.id,
        organization_id: activeOrgId!, resource_type: "notification_rule",
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-rules"] });
      setOpen(false);
      setForm({ name: "", description: "", trigger_event: "deadline_approaching", channels: ["email"], template: "" });
      toast({ title: "Regra criada" });
    },
    onError: () => toast({ title: "Erro ao criar regra", variant: "destructive" }),
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("notification_rules").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-rules"] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notification_rules").delete().eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "notification_rule_deleted", user_id: user!.id,
        organization_id: activeOrgId!, resource_type: "notification_rule", resource_id: id,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-rules"] });
      toast({ title: "Regra removida" });
    },
  });

  const toggleChannel = (ch: string) => {
    setForm((prev) => ({
      ...prev,
      channels: prev.channels.includes(ch)
        ? prev.channels.filter((c) => c !== ch)
        : [...prev.channels, ch],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center">
            <BellRing className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h1 className="text-display-sm text-foreground">Regras de Notificação</h1>
            <p className="text-body-sm text-muted-foreground">Automação de alertas por evento</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Nova Regra</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Regra de Notificação</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Alerta de prazo próximo" /></div>
              <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
              <div>
                <Label>Evento Gatilho</Label>
                <Select value={form.trigger_event} onValueChange={(v) => setForm({ ...form, trigger_event: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_EVENTS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Canais</Label>
                <div className="flex gap-3 mt-1">
                  {CHANNELS.map((ch) => (
                    <label key={ch.value} className="flex items-center gap-2 text-body-sm cursor-pointer">
                      <input type="checkbox" checked={form.channels.includes(ch.value)} onChange={() => toggleChannel(ch.value)} className="rounded" />
                      {ch.label}
                    </label>
                  ))}
                </div>
              </div>
              <div><Label>Template da Mensagem</Label><Textarea value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })} rows={3} placeholder="Use {{processo}}, {{cliente}}, {{prazo}}..." /></div>
              <Button onClick={() => createRule.mutate()} disabled={!form.name || form.channels.length === 0 || createRule.isPending} className="w-full">Criar Regra</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : rules.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <BellRing className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Nenhuma regra configurada</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {rules.map((r: any) => {
            const triggerLabel = TRIGGER_EVENTS.find((e) => e.value === r.trigger_event)?.label || r.trigger_event;
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Zap className={`h-5 w-5 shrink-0 ${r.is_active ? "text-warning" : "text-muted-foreground"}`} />
                  <div>
                    <p className="font-medium text-foreground">{r.name}</p>
                    <div className="flex items-center gap-2 text-caption text-muted-foreground mt-0.5 flex-wrap">
                      <Badge variant="outline">{triggerLabel}</Badge>
                      {(r.channels || []).map((ch: string) => (
                        <Badge key={ch} variant="secondary">{ch}</Badge>
                      ))}
                      <span>{format(new Date(r.created_at), "dd/MM/yy", { locale: ptBR })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={r.is_active} onCheckedChange={(v) => toggleRule.mutate({ id: r.id, is_active: v })} />
                  <Button variant="ghost" size="icon" onClick={() => deleteRule.mutate(r.id)}>
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
