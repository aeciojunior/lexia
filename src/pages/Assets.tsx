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
import { Package, Plus, Monitor, HardDrive, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ASSET_TYPES = [
  { value: "digital", label: "Digital" },
  { value: "physical", label: "Físico" },
];

const CATEGORIES = [
  { value: "software_license", label: "Licença de Software" },
  { value: "certificate", label: "Certificado Digital" },
  { value: "token", label: "Token de Acesso" },
  { value: "template", label: "Template" },
  { value: "knowledge_base", label: "Base de Conhecimento" },
  { value: "hardware", label: "Hardware" },
  { value: "other", label: "Outro" },
];

const STATUS_BADGES: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  borrowed: "secondary",
  expired: "destructive",
  maintenance: "outline",
};

const Assets = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", asset_type: "digital", category: "other", description: "", location: "", expires_at: "" });
  const canManage = hasPermission("MANAGE_ASSETS");

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["assets", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("assets").select("*").eq("organization_id", activeOrgId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("assets").insert({
        organization_id: activeOrgId!,
        name: form.name,
        asset_type: form.asset_type,
        category: form.category,
        description: form.description || null,
        location: form.location || null,
        expires_at: form.expires_at || null,
        created_by: user!.id,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "asset_created", user_id: user!.id, organization_id: activeOrgId!, resource_type: "asset", metadata: { name: form.name } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      setOpen(false);
      setForm({ name: "", asset_type: "digital", category: "other", description: "", location: "", expires_at: "" });
      toast({ title: "Ativo cadastrado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const expiringSoon = assets.filter(a => a.expires_at && new Date(a.expires_at) < new Date(Date.now() + 30 * 86400000) && new Date(a.expires_at) > new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Inventário & Ativos</h1>
          <p className="text-muted-foreground">Gestão de ativos digitais e físicos</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo Ativo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Cadastrar Ativo</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Tipo</Label>
                    <Select value={form.asset_type} onValueChange={v => setForm(f => ({ ...f, asset_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ASSET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Categoria</Label>
                    <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div><Label>Localização</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
                <div><Label>Validade (opcional)</Label><Input type="datetime-local" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} /></div>
                <Button onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending} className="w-full">Cadastrar</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {expiringSoon.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="text-sm">{expiringSoon.length} ativo(s) expirando nos próximos 30 dias</span>
          </CardContent>
        </Card>
      )}

      {isLoading ? <p className="text-muted-foreground">Carregando...</p> :
        assets.length === 0 ? (
          <Card><CardContent className="py-12 text-center"><Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhum ativo cadastrado</p></CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {assets.map(a => (
              <Card key={a.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    {a.asset_type === "digital" ? <Monitor className="h-5 w-5 text-primary" /> : <HardDrive className="h-5 w-5 text-primary" />}
                    <CardTitle className="text-base truncate">{a.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge variant={STATUS_BADGES[a.status] || "outline"}>{a.status}</Badge>
                    <Badge variant="outline">{CATEGORIES.find(c => c.value === a.category)?.label || a.category}</Badge>
                    <Badge variant="secondary">v{a.version}</Badge>
                  </div>
                  {a.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{a.description}</p>}
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {a.location && <p>📍 {a.location}</p>}
                    {a.expires_at && <p>⏰ Expira: {format(new Date(a.expires_at), "dd/MM/yyyy", { locale: ptBR })}</p>}
                    <p>Criado: {format(new Date(a.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      }
    </div>
  );
};

export default Assets;
