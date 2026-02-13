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
import { ShieldCheck, Plus, Trash2, Lock, Unlock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const RESOURCE_TYPES = [
  { value: "process", label: "Processo" },
  { value: "document", label: "Documento" },
  { value: "task", label: "Tarefa" },
  { value: "client", label: "Cliente" },
  { value: "contract", label: "Contrato" },
  { value: "financial", label: "Financeiro" },
];

const ACTIONS = [
  { value: "view", label: "Visualizar" },
  { value: "edit", label: "Editar" },
  { value: "delete", label: "Excluir" },
  { value: "share", label: "Compartilhar" },
  { value: "download", label: "Baixar" },
  { value: "comment", label: "Comentar" },
];

export default function ACLPermissions() {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    resource_type: "process",
    resource_id: "",
    action: "view",
    effect: "allow",
    target_user_id: "",
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["acl-rules", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acl_rules")
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
      const { error } = await supabase.from("acl_rules").insert({
        organization_id: activeOrgId!,
        created_by: user!.id,
        resource_type: form.resource_type,
        resource_id: form.resource_id || null,
        action: form.action,
        effect: form.effect,
        target_user_id: form.target_user_id || null,
      });
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        action: "acl_created",
        user_id: user!.id,
        organization_id: activeOrgId!,
        resource_type: "acl",
        metadata: { resource_type: form.resource_type, action: form.action, effect: form.effect },
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["acl-rules"] });
      setOpen(false);
      setForm({ resource_type: "process", resource_id: "", action: "view", effect: "allow", target_user_id: "" });
      toast({ title: "Regra ACL criada" });
    },
    onError: () => toast({ title: "Erro ao criar regra", variant: "destructive" }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("acl_rules").delete().eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "acl_deleted", user_id: user!.id, organization_id: activeOrgId!, resource_type: "acl", resource_id: id,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["acl-rules"] });
      toast({ title: "Regra removida" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-secondary/10 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <h1 className="text-display-sm text-foreground">Permissões Avançadas (ACL)</h1>
            <p className="text-body-sm text-muted-foreground">Controle granular de acesso a recursos</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Nova Regra</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Regra ACL</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tipo de Recurso</Label>
                <Select value={form.resource_type} onValueChange={(v) => setForm({ ...form, resource_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESOURCE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ID do Recurso (opcional)</Label>
                <Input value={form.resource_id} onChange={(e) => setForm({ ...form, resource_id: e.target.value })} placeholder="UUID específico ou vazio para todos" />
              </div>
              <div>
                <Label>Ação</Label>
                <Select value={form.action} onValueChange={(v) => setForm({ ...form, action: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Efeito</Label>
                <Select value={form.effect} onValueChange={(v) => setForm({ ...form, effect: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allow">Permitir</SelectItem>
                    <SelectItem value="deny">Negar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ID do Usuário Alvo (opcional)</Label>
                <Input value={form.target_user_id} onChange={(e) => setForm({ ...form, target_user_id: e.target.value })} placeholder="UUID do usuário" />
              </div>
              <Button onClick={() => createRule.mutate()} disabled={createRule.isPending} className="w-full">Criar Regra</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : rules.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Nenhuma regra ACL configurada</p>
          <p className="text-caption text-muted-foreground">O RBAC padrão está ativo para todos os recursos</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {rules.map((r: any) => {
            const resLabel = RESOURCE_TYPES.find((t) => t.value === r.resource_type)?.label || r.resource_type;
            const actLabel = ACTIONS.find((a) => a.value === r.action)?.label || r.action;
            const isDeny = r.effect === "deny";
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {isDeny ? <Lock className="h-5 w-5 text-destructive shrink-0" /> : <Unlock className="h-5 w-5 text-accent shrink-0" />}
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={isDeny ? "destructive" : "default"}>{isDeny ? "Negar" : "Permitir"}</Badge>
                      <span className="font-medium text-foreground">{actLabel}</span>
                      <span className="text-muted-foreground">em</span>
                      <Badge variant="outline">{resLabel}</Badge>
                    </div>
                    <p className="text-caption text-muted-foreground mt-1">
                      {r.resource_id ? `Recurso: ${r.resource_id.slice(0, 8)}...` : "Todos os recursos"}
                      {r.target_user_id && ` · Usuário: ${r.target_user_id.slice(0, 8)}...`}
                      {" · "}{format(new Date(r.created_at), "dd/MM/yy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteRule.mutate(r.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
