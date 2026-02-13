import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { KeyRound, Plus, RotateCw, Eye, EyeOff, Trash2, Shield, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const SECRET_TYPES = [
  { value: "api_token", label: "Token de API" },
  { value: "credential", label: "Credencial" },
  { value: "certificate", label: "Certificado" },
  { value: "private_key", label: "Chave Privada" },
  { value: "password", label: "Senha" },
  { value: "webhook_secret", label: "Segredo Webhook" },
  { value: "other", label: "Outro" },
];

const SecretManager = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", secret_type: "api_token", value: "", expires_at: "" });
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const canManage = hasPermission("MANAGE_SECRETS");

  const { data: secrets = [], isLoading } = useQuery({
    queryKey: ["org-secrets", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_secrets")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const encoded = btoa(form.value);
      const { error } = await supabase.from("org_secrets").insert({
        organization_id: activeOrgId!,
        name: form.name,
        description: form.description,
        secret_type: form.secret_type,
        encrypted_value: encoded,
        expires_at: form.expires_at || null,
        created_by: user!.id,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "secret_created",
        user_id: user!.id,
        organization_id: activeOrgId!,
        resource_type: "org_secret",
        metadata: { name: form.name, type: form.secret_type },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-secrets"] });
      setOpen(false);
      setForm({ name: "", description: "", secret_type: "api_token", value: "", expires_at: "" });
      toast({ title: "Segredo criado com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const rotateMutation = useMutation({
    mutationFn: async (id: string) => {
      const newValue = crypto.randomUUID();
      const { error } = await supabase
        .from("org_secrets")
        .update({ encrypted_value: btoa(newValue), version: (secrets.find(s => s.id === id)?.version || 0) + 1, rotated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "secret_rotated",
        user_id: user!.id,
        organization_id: activeOrgId!,
        resource_type: "org_secret",
        resource_id: id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-secrets"] });
      toast({ title: "Segredo rotacionado" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("org_secrets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-secrets"] });
      toast({ title: "Segredo removido" });
    },
  });

  const toggleReveal = (id: string) => {
    setRevealedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Secret Manager</h1>
          <p className="text-muted-foreground">Gerencie credenciais e segredos da organização</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Segredo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar Segredo</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: CLICKSIGN_TOKEN" /></div>
                <div><Label>Tipo</Label>
                  <Select value={form.secret_type} onValueChange={v => setForm(f => ({ ...f, secret_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SECRET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Valor</Label><Textarea value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="Cole o token/senha aqui" className="font-mono text-sm" /></div>
                <div><Label>Descrição</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div><Label>Expira em (opcional)</Label><Input type="datetime-local" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} /></div>
                <Button onClick={() => createMutation.mutate()} disabled={!form.name || !form.value || createMutation.isPending} className="w-full">
                  {createMutation.isPending ? "Salvando..." : "Salvar Segredo"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : secrets.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhum segredo cadastrado</p></CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {secrets.map(s => {
            const isExpired = s.expires_at && new Date(s.expires_at) < new Date();
            return (
              <Card key={s.id} className={isExpired ? "border-destructive/50" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <KeyRound className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{s.name}</CardTitle>
                      <Badge variant="outline">{SECRET_TYPES.find(t => t.value === s.secret_type)?.label || s.secret_type}</Badge>
                      <Badge variant="secondary">v{s.version}</Badge>
                      {isExpired && <Badge variant="destructive">Expirado</Badge>}
                    </div>
                    {canManage && (
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => toggleReveal(s.id)}>{revealedIds.has(s.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                        <Button variant="ghost" size="icon" onClick={() => rotateMutation.mutate(s.id)}><RotateCw className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {s.description && <p className="text-sm text-muted-foreground mb-2">{s.description}</p>}
                  {revealedIds.has(s.id) && (
                    <pre className="bg-muted rounded-lg p-3 text-xs font-mono break-all">{atob(s.encrypted_value)}</pre>
                  )}
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Criado: {format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                    {s.rotated_at && <span>Rotacionado: {format(new Date(s.rotated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>}
                    {s.expires_at && <span>Expira: {format(new Date(s.expires_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SecretManager;
