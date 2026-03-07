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
import { PenLine, Plus, Send } from "lucide-react";
import { format } from "date-fns";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  sent: { label: "Enviada", variant: "secondary" },
  partially_signed: { label: "Parcial", variant: "default" },
  completed: { label: "Concluída", variant: "default" },
  canceled: { label: "Cancelada", variant: "destructive" },
  failed: { label: "Falhou", variant: "destructive" },
};

const providerLabels: Record<string, string> = {
  internal: "Interna",
  clicksign: "Clicksign",
  docusign: "DocuSign",
};

export default function Signatures() {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ title: "", description: "", provider: "internal", signers: "" });

  const canManage = hasPermission("MANAGE_SIGNATURES");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["signature-requests", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signature_requests")
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
      const signers = form.signers.split(",").map((s) => s.trim()).filter(Boolean).map((email) => ({ email, status: "pending" }));
      const { error } = await supabase.from("signature_requests").insert({
        organization_id: activeOrgId!,
        title: form.title,
        description: form.description || null,
        provider: form.provider,
        signers,
        created_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signature-requests"] });
      setOpen(false);
      setForm({ title: "", description: "", provider: "internal", signers: "" });
      toast({ title: "Solicitação de assinatura criada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const filtered = requests.filter((r: any) => r.title?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page-layout">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <PenLine className="h-6 w-6 text-primary" /> Assinaturas Digitais
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie solicitações de assinatura digital</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nova Solicitação</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Nova Solicitação de Assinatura</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Provedor</Label>
                  <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Interna</SelectItem>
                      <SelectItem value="clicksign">Clicksign</SelectItem>
                      <SelectItem value="docusign">DocuSign</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Signatários (e-mails separados por vírgula)</Label>
                  <Input value={form.signers} onChange={(e) => setForm({ ...form, signers: e.target.value })} placeholder="email1@ex.com, email2@ex.com" />
                </div>
                <Button onClick={() => createMutation.mutate()} disabled={!form.title || createMutation.isPending} className="w-full">
                  <Send className="mr-2 h-4 w-4" /> Enviar para Assinatura
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle className="text-lg">Solicitações</CardTitle>
          <Input className="w-full sm:max-w-xs" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-10 text-center text-muted-foreground">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">Nenhuma solicitação encontrada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Provedor</TableHead>
                  <TableHead>Signatários</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r: any) => {
                  const cfg = statusConfig[r.status] || statusConfig.pending;
                  const signers = Array.isArray(r.signers) ? r.signers : [];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.title}</TableCell>
                      <TableCell>{providerLabels[r.provider] || r.provider}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {signers.map((s: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">{s.email}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant={cfg.variant}>{cfg.label}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yyyy")}</TableCell>
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
