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
import { toast } from "@/hooks/use-toast";
import { Lock, Upload, Download, Eye, FileText, Shield } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const DOC_CATEGORIES = [
  { value: "strategic_contract", label: "Contrato Estratégico" },
  { value: "confidential", label: "Documento Sigiloso" },
  { value: "lgpd_sensitive", label: "Dados Pessoais (LGPD)" },
  { value: "financial_critical", label: "Financeiro Crítico" },
  { value: "compliance", label: "Compliance" },
  { value: "certificate", label: "Certificado" },
  { value: "other", label: "Outro" },
];

const VaultDocuments = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ name: "", category: "confidential", description: "" });
  const canManage = hasPermission("MANAGE_VAULT");

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["vault-documents", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vault_documents")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione um arquivo");
      const path = `${activeOrgId}/${crypto.randomUUID()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("vault").upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("vault").getPublicUrl(path);

      const { error } = await supabase.from("vault_documents").insert({
        organization_id: activeOrgId!,
        title: form.name || file.name,
        file_name: file.name,
        file_url: path,
        file_size: file.size,
        file_type: file.type,
        category: form.category,
        description: form.description || null,
        uploaded_by: user!.id,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "vault_document_uploaded", user_id: user!.id, organization_id: activeOrgId!, resource_type: "vault_document", metadata: { file_name: file.name, category: form.category } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vault-documents"] });
      setOpen(false);
      setFile(null);
      setForm({ name: "", category: "confidential", description: "" });
      toast({ title: "Documento salvo no cofre" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleDownload = async (doc: any) => {
    const { data, error } = await supabase.storage.from("vault").createSignedUrl(doc.file_url, 60);
    if (error) { toast({ title: "Erro ao gerar URL", variant: "destructive" }); return; }
    await supabase.from("audit_logs").insert({ action: "vault_document_accessed", user_id: user!.id, organization_id: activeOrgId!, resource_type: "vault_document", resource_id: doc.id });
    window.open(data.signedUrl, "_blank");
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Cofre Seguro</h1>
          <p className="text-muted-foreground">Documentos sensíveis com criptografia e controle de acesso</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Upload className="h-4 w-4 mr-2" />Upload Seguro</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Upload ao Cofre Seguro</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Arquivo</Label><Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} /></div>
                <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do documento" /></div>
                <div><Label>Categoria</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DOC_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Descrição</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <Button onClick={() => uploadMutation.mutate()} disabled={!file || uploadMutation.isPending} className="w-full">
                  <Lock className="h-4 w-4 mr-2" />{uploadMutation.isPending ? "Enviando..." : "Enviar ao Cofre"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? <p className="text-muted-foreground">Carregando...</p> :
        docs.length === 0 ? (
          <Card><CardContent className="py-12 text-center"><Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhum documento no cofre</p></CardContent></Card>
        ) : (
          <div className="grid gap-4">
            {docs.map(d => (
              <Card key={d.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Lock className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{d.file_name}</CardTitle>
                      <Badge variant="outline">{DOC_CATEGORIES.find(c => c.value === d.category)?.label || d.category}</Badge>
                      <Badge variant="secondary">{d.access_level}</Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(d)}><Download className="h-4 w-4 mr-1" />Acessar</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    {d.file_size && <span>{formatSize(d.file_size)}</span>}
                    <span>{format(new Date(d.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                    {d.description && <span>• {d.description}</span>}
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

export default VaultDocuments;
