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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { MessageSquareText, Plus, Mail, MessageCircle, Bell, Trash2 } from "lucide-react";
import { format } from "date-fns";

const channelConfig: Record<string, { label: string; icon: any }> = {
  email: { label: "E-mail", icon: Mail },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  notification: { label: "Notificação", icon: Bell },
};

export default function CommunicationTemplates() {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ title: "", channel: "email", content: "", variables: "" });

  const canManage = hasPermission("MANAGE_COMMUNICATION_TEMPLATES");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["comm-templates", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communication_templates")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const vars = form.variables.split(",").map((v) => v.trim()).filter(Boolean);
      const { error } = await supabase.from("communication_templates").insert({
        organization_id: activeOrgId!,
        title: form.title,
        channel: form.channel,
        content: form.content,
        variables: vars,
        created_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comm-templates"] });
      setOpen(false);
      setForm({ title: "", channel: "email", content: "", variables: "" });
      toast({ title: "Template criado com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("communication_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comm-templates"] });
      toast({ title: "Template removido" });
    },
  });

  const filtered = templates.filter((t: any) => t.title?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquareText className="h-6 w-6 text-primary" /> Templates de Comunicação
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Padronize mensagens para e-mail, WhatsApp e notificações</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Novo Template</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Template de Comunicação</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div>
                  <Label>Canal</Label>
                  <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="notification">Notificação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Conteúdo</Label>
                  <Textarea rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Use {{cliente}}, {{processo}}, {{prazo}} etc." />
                </div>
                <div>
                  <Label>Variáveis (separadas por vírgula)</Label>
                  <Input value={form.variables} onChange={(e) => setForm({ ...form, variables: e.target.value })} placeholder="cliente, processo, prazo" />
                </div>
                <Button onClick={() => createMutation.mutate()} disabled={!form.title || !form.content || createMutation.isPending} className="w-full">
                  Criar Template
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Templates</span>
            <Input className="max-w-xs" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum template encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Variáveis</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Data</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t: any) => {
                  const ch = channelConfig[t.channel] || channelConfig.email;
                  const ChIcon = ch.icon;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell><Badge variant="outline" className="gap-1"><ChIcon className="h-3 w-3" />{ch.label}</Badge></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(t.variables || []).map((v: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">{`{{${v}}}`}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">v{t.version}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{format(new Date(t.created_at), "dd/MM/yyyy")}</TableCell>
                      {canManage && (
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(t.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
