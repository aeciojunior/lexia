import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Upload, FileText, Trash2, Download, Eye, FolderOpen, File, FileSpreadsheet, FileImage, ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const PAGE_SIZE = 12;

const categoryMap: Record<string, string> = {
  petition: "Petição",
  contract: "Contrato",
  evidence: "Prova",
  court_order: "Decisão Judicial",
  correspondence: "Correspondência",
  power_of_attorney: "Procuração",
  report: "Relatório",
  other: "Outro",
};

const categoryIcon = (cat: string) => {
  switch (cat) {
    case "petition": case "contract": case "power_of_attorney": return FileText;
    case "evidence": case "report": return FileSpreadsheet;
    default: return File;
  }
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const Documents = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  // Upload form
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState("other");
  const [uploadProcessId, setUploadProcessId] = useState("none");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  // Fetch documents
  const { data, isLoading } = useQuery({
    queryKey: ["documents", search, categoryFilter, page],
    queryFn: async () => {
      let q = supabase
        .from("documents")
        .select("*, processes(title, number)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (categoryFilter !== "all") q = q.eq("category", categoryFilter);
      if (search) q = q.ilike("file_name", `%${search}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { items: data || [], count: count || 0 };
    },
  });

  // Fetch processes for linking
  const { data: processes = [] } = useQuery({
    queryKey: ["processes-list-for-docs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("processes").select("id, title, number").eq("archived", false).order("title");
      if (error) throw error;
      return data;
    },
  });

  // Upload mutation
  const handleUpload = async () => {
    if (!uploadFile || !user) return;
    setUploading(true);
    try {
      const ext = uploadFile.name.split(".").pop();
      const orgPath = activeOrgId || user.id;
      const path = `${orgPath}/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, uploadFile);
      if (upErr) throw upErr;

      // Get signed URL (private bucket)
      const { data: urlData } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 60 * 24 * 365);

      const { error: dbErr } = await supabase.from("documents").insert({
        user_id: user.id,
        organization_id: activeOrgId,
        file_name: uploadFile.name,
        file_url: path,
        file_size: uploadFile.size,
        file_type: uploadFile.type,
        category: uploadCategory,
        process_id: uploadProcessId === "none" ? null : uploadProcessId,
        notes: uploadNotes || null,
      } as any);
      if (dbErr) throw dbErr;

      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setUploadDialog(false);
      resetUploadForm();
      toast.success("Documento enviado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadCategory("other");
    setUploadProcessId("none");
    setUploadNotes("");
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      // Delete from storage
      const { error: stErr } = await supabase.storage.from("documents").remove([doc.file_url]);
      if (stErr) throw stErr;
      // Delete from DB
      const { error: dbErr } = await supabase.from("documents").delete().eq("id", doc.id);
      if (dbErr) throw dbErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Documento excluído!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const downloadFile = async (doc: any) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.file_url, 60);
    if (error) {
      toast.error("Erro ao gerar link de download");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const totalPages = Math.ceil((data?.count || 0) / PAGE_SIZE);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-overline text-primary mb-1">Gestão</p>
          <h1 className="text-display-lg">Documentos</h1>
          <p className="text-body-sm text-muted-foreground mt-1">Gerencie seus documentos jurídicos</p>
        </div>
        <Button variant="hero" onClick={() => { resetUploadForm(); setUploadDialog(true); }}>
          <Upload className="h-4 w-4" /> Enviar Documento
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10 h-11 rounded-xl bg-muted border-border" placeholder="Buscar documento..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
          <SelectTrigger className="w-44 h-11 rounded-xl bg-muted border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Categorias</SelectItem>
            {Object.entries(categoryMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Documents grid */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        {isLoading ? (
          <div className="py-16 text-center">
            <div className="flex gap-1.5 justify-center mb-3">
              <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse-glow" />
              <span className="h-2.5 w-2.5 rounded-full bg-secondary animate-pulse-glow" style={{ animationDelay: "200ms" }} />
              <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse-glow" style={{ animationDelay: "400ms" }} />
            </div>
            <p className="text-body-sm text-muted-foreground">Carregando documentos...</p>
          </div>
        ) : !data?.items.length ? (
          <LexCard hover={false}>
            <div className="py-16 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-body-sm text-muted-foreground mb-3">Nenhum documento encontrado.</p>
              <Button variant="outline" size="sm" onClick={() => setUploadDialog(true)}>
                Enviar primeiro documento
              </Button>
            </div>
          </LexCard>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.items.map((doc: any, i: number) => {
              const Icon = categoryIcon(doc.category);
              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.35 }}
                >
                  <LexCard variant="default" className="flex flex-col h-full group">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-body-sm font-medium truncate">{doc.file_name}</p>
                        <p className="text-caption text-muted-foreground">{formatFileSize(doc.file_size)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <LexBadge variant="outline">{categoryMap[doc.category] || doc.category}</LexBadge>
                      {doc.processes && (
                        <LexBadge variant="info" className="truncate max-w-[140px]">{doc.processes.number}</LexBadge>
                      )}
                    </div>

                    {doc.notes && <p className="text-caption text-muted-foreground line-clamp-2 mb-3">{doc.notes}</p>}

                    <div className="mt-auto pt-3 border-t border-border/40 flex items-center justify-between">
                      <p className="text-caption text-muted-foreground">
                        {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                      </p>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-normal">
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => downloadFile(doc)}><Download className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => { setSelectedDoc(doc); setViewDialog(true); }}><Eye className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:text-destructive" onClick={() => deleteMutation.mutate(doc)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </LexCard>
                </motion.div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-4">
            <p className="text-caption text-muted-foreground">{data?.count} documentos • Página {page + 1}/{totalPages}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Enviar Documento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadFile ? (
                <div>
                  <FileText className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-body-sm font-medium truncate">{uploadFile.name}</p>
                  <p className="text-caption text-muted-foreground">{formatFileSize(uploadFile.size)}</p>
                </div>
              ) : (
                <div>
                  <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-body-sm text-muted-foreground">Clique para selecionar um arquivo</p>
                  <p className="text-caption text-muted-foreground mt-1">PDF, DOCX, imagens até 20MB</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
            </div>

            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Categoria</label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Vincular a Processo (opcional)</label>
              <Select value={uploadProcessId} onValueChange={setUploadProcessId}>
                <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {processes.map((p) => <SelectItem key={p.id} value={p.id}>{p.number} — {p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Observações</label>
              <Textarea className="bg-muted border-border rounded-xl" value={uploadNotes} onChange={(e) => setUploadNotes(e.target.value)} rows={2} placeholder="Descrição opcional..." />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadDialog(false)}>Cancelar</Button>
              <Button onClick={handleUpload} disabled={!uploadFile || uploading}>
                {uploading ? "Enviando..." : "Enviar"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialog} onOpenChange={setViewDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Detalhes do Documento</DialogTitle></DialogHeader>
          {selectedDoc && (
            <div className="space-y-4 text-body-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-overline text-muted-foreground block mb-0.5">Arquivo</span><span className="font-medium">{selectedDoc.file_name}</span></div>
                <div><span className="text-overline text-muted-foreground block mb-0.5">Tamanho</span>{formatFileSize(selectedDoc.file_size)}</div>
                <div><span className="text-overline text-muted-foreground block mb-0.5">Categoria</span><LexBadge variant="outline">{categoryMap[selectedDoc.category]}</LexBadge></div>
                <div><span className="text-overline text-muted-foreground block mb-0.5">Data</span>{new Date(selectedDoc.created_at).toLocaleDateString("pt-BR")}</div>
                {selectedDoc.processes && (
                  <div className="col-span-2"><span className="text-overline text-muted-foreground block mb-0.5">Processo Vinculado</span>{selectedDoc.processes.number} — {selectedDoc.processes.title}</div>
                )}
              </div>
              {selectedDoc.notes && <div><span className="text-overline text-muted-foreground block mb-1">Observações</span><p className="rounded-xl bg-muted p-3">{selectedDoc.notes}</p></div>}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => downloadFile(selectedDoc)}><Download className="h-4 w-4" /> Download</Button>
                <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => { deleteMutation.mutate(selectedDoc); setViewDialog(false); }}><Trash2 className="h-4 w-4" /> Excluir</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Documents;
