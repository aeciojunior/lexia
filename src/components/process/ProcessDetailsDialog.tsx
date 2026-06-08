import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import ProcessMovements from "@/components/process/ProcessMovements";
import ProcessChat from "@/components/process/ProcessChat";
import ProcessTimeline from "@/components/process/ProcessTimeline";
import ProcessClassification from "@/components/process/ProcessClassification";
import DecisionExtraction from "@/components/process/DecisionExtraction";
import ProcessSummary360 from "@/components/process/ProcessSummary360";
import ProcessPredictionsPanel from "@/components/process/ProcessPredictionsPanel";
import { LexBadge } from "@/components/lexia/LexBadge";
import { RiskIndicator } from "@/components/lexia/LegalComponents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileText, Download, Upload, Link2, X, CalendarClock, AlertTriangle, RefreshCcw, Loader2, Building2, ArrowLeftRight, ListTodo, CheckCircle2, Circle, Clock, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { statusMap, typeMap } from "@/lib/processConstants";

export function ProcessDetailsDialog({ open, onOpenChange, process, getMemberName, activeOrgId }: { open: boolean; onOpenChange: (open: boolean) => void; process: any | null; getMemberName: (id: string) => string; activeOrgId: string | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-display-sm">Detalhes do Processo</DialogTitle></DialogHeader>
        {process && (
          <ProcessDetailsContent process={process} getMemberName={getMemberName} activeOrgId={activeOrgId} />
        )}
      </DialogContent>
    </Dialog>
  );
}
/* ─── Linked Documents with Filters ─── */
const CATEGORY_OPTIONS = [
  { value: "__all__", label: "Todas categorias" },
  { value: "petition", label: "Petição Inicial" },
  { value: "contestation", label: "Contestação" },
  { value: "contract", label: "Contrato" },
  { value: "evidence", label: "Provas" },
  { value: "court_order", label: "Decisão Judicial" },
  { value: "hearing_doc", label: "Audiência (ata/termo)" },
  { value: "recurso", label: "Recurso" },
  { value: "correspondence", label: "Correspondência" },
  { value: "power_of_attorney", label: "Procuração" },
  { value: "internal", label: "Documento Interno" },
  { value: "report", label: "Relatório" },
  { value: "other", label: "Outro" },
];

const LinkedDocsSection = ({ docs, loading, processId }: { docs: any[]; loading: boolean; processId: string }) => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docSearch, setDocSearch] = useState("");
  const [docCategory, setDocCategory] = useState("__all__");
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);

  const toggleCompareDoc = (docId: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(docId)) return prev.filter((id) => id !== docId);
      if (prev.length >= 2) return [prev[1], docId];
      return [...prev, docId];
    });
  };

  const launchComparison = async () => {
    if (compareSelection.length !== 2) return;
    const docA = docs.find((d: any) => d.id === compareSelection[0]);
    const docB = docs.find((d: any) => d.id === compareSelection[1]);
    if (!docA || !docB) return;

    navigate("/text-comparison", {
      state: {
        labelA: docA.file_name,
        labelB: docB.file_name,
        comparisonType: "contextual_legal",
        sourceDocA: docA,
        sourceDocB: docB,
      },
    });
  };

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState("other");
  const [uploadEventId, setUploadEventId] = useState("none");
  const [uploadName, setUploadName] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadCategory("other");
    setUploadEventId("none");
    setUploadName("");
    setUploadNotes("");
  };

  // Fetch events for linking
  const { data: processEvents = [] } = useQuery({
    queryKey: ["process-events-for-docs", processId],
    queryFn: async () => {
      const { data } = await supabase
        .from("process_events" as any)
        .select("id, title, event_type, event_date")
        .eq("process_id", processId)
        .order("event_date", { ascending: false });
      return (data as any[]) || [];
    },
    enabled: showUploadDialog,
  });

  // Fetch unlinked docs for the link dialog
  const { data: unlinkedDocs = [] } = useQuery({
    queryKey: ["unlinked-docs-for-process", activeOrgId, linkSearch],
    queryFn: async () => {
      let q = supabase
        .from("documents")
        .select("id, file_name, file_type, file_size, created_at, category")
        .is("process_id", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (linkSearch) q = q.ilike("file_name", `%${linkSearch}%`);
      const { data } = await q;
      return (data as any[]) || [];
    },
    enabled: showLinkDialog,
  });

  const linkMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.from("documents").update({ process_id: processId } as any).eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-linked-docs", processId] });
      queryClient.invalidateQueries({ queryKey: ["unlinked-docs-for-process"] });
      toast.success("Documento vinculado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unlinkMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.from("documents").update({ process_id: null } as any).eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-linked-docs", processId] });
      toast.success("Documento desvinculado.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleUpload = async () => {
    if (!uploadFile || !user) return;
    setUploading(true);
    try {
      const ext = uploadFile.name.split(".").pop();
      const orgPath = activeOrgId || user.id;
      const path = `${orgPath}/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, uploadFile);
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from("documents").insert({
        user_id: user.id,
        organization_id: activeOrgId,
        file_name: uploadName.trim() || uploadFile.name,
        file_url: path,
        file_size: uploadFile.size,
        file_type: uploadFile.type,
        category: uploadCategory,
        process_id: processId,
        event_id: uploadEventId === "none" ? null : uploadEventId,
        notes: uploadNotes.trim() || null,
        origin: "manual",
      } as any);
      if (dbErr) throw dbErr;

      queryClient.invalidateQueries({ queryKey: ["process-linked-docs", processId] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setShowUploadDialog(false);
      resetUploadForm();
      toast.success("Documento anexado com sucesso!");
    } catch (err: any) {
      toast.error("Não foi possível anexar o documento: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const downloadFile = async (doc: any) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.file_url, 60);
    if (error) { toast.error("Erro ao gerar link de download"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const filtered = useMemo(() => {
    return docs.filter((doc: any) => {
      const matchSearch = !docSearch || doc.file_name.toLowerCase().includes(docSearch.toLowerCase());
      const matchCat = docCategory === "__all__" || doc.category === docCategory;
      return matchSearch && matchCat;
    });
  }, [docs, docSearch, docCategory]);

  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-overline text-muted-foreground">Documentos vinculados</span>
        </div>
        <div className="flex items-center gap-1.5">
          {docs.length > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {filtered.length}/{docs.length}
            </span>
          )}
          {compareSelection.length === 2 && (
            <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={launchComparison}>
              <ArrowLeftRight className="h-3 w-3" /> Comparar
            </Button>
          )}
          {compareSelection.length > 0 && compareSelection.length < 2 && (
            <span className="text-[10px] text-muted-foreground">Selecione mais 1</span>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Vincular documento existente" onClick={() => setShowLinkDialog(true)}>
            <Link2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Anexar novo documento"
            onClick={() => { resetUploadForm(); setShowUploadDialog(true); }}
          >
            <Upload className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-caption text-muted-foreground text-center py-4">Carregando documentos...</p>
      ) : docs.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-caption text-muted-foreground mb-2">Nenhum documento vinculado.</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setShowLinkDialog(true)}>
              <Link2 className="h-3 w-3 mr-1" /> Vincular existente
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { resetUploadForm(); setShowUploadDialog(true); }}>
              <Upload className="h-3 w-3 mr-1" /> Anexar novo
            </Button>
          </div>
        </div>
      ) : (
        <>
          {docs.length > 3 && (
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input placeholder="Buscar documento..." value={docSearch} onChange={(e) => setDocSearch(e.target.value)} className="h-7 text-xs pl-7" />
              </div>
              <Select value={docCategory} onValueChange={setDocCategory}>
                <SelectTrigger className="h-7 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {filtered.length === 0 ? (
            <p className="text-caption text-muted-foreground text-center py-3">Nenhum documento encontrado com os filtros aplicados.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {filtered.map((doc: any) => {
                const sizeKB = doc.file_size ? (doc.file_size / 1024).toFixed(0) : null;
                const sizeLabel = sizeKB ? (Number(sizeKB) > 1024 ? `${(Number(sizeKB) / 1024).toFixed(1)} MB` : `${sizeKB} KB`) : null;
                return (
                  <div key={doc.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={compareSelection.includes(doc.id)}
                      onCheckedChange={() => toggleCompareDoc(doc.id)}
                      className="h-3.5 w-3.5 shrink-0"
                      title="Selecionar para comparação"
                    />
                    <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="flex-1 text-caption truncate text-foreground">{doc.file_name}</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                      {CATEGORY_OPTIONS.find((c) => c.value === doc.category)?.label || doc.category}
                    </Badge>
                    {doc.event_id && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0 text-info">Evento</Badge>
                    )}
                    {sizeLabel && <span className="text-[10px] text-muted-foreground shrink-0">{sizeLabel}</span>}
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(doc.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-primary shrink-0" onClick={() => downloadFile(doc)}>
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-destructive shrink-0"
                      title="Desvincular"
                      onClick={() => unlinkMutation.mutate(doc.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Upload dialog */}
      <Dialog open={showUploadDialog} onOpenChange={(open) => { if (!open) resetUploadForm(); setShowUploadDialog(open); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Anexar Documento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Drop zone */}
            <div
              className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadFile ? (
                <div>
                  <FileText className="h-7 w-7 text-primary mx-auto mb-1.5" />
                  <p className="text-caption font-medium truncate">{uploadFile.name}</p>
                  <p className="text-[10px] text-muted-foreground">{(uploadFile.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div>
                  <Upload className="h-7 w-7 text-muted-foreground/40 mx-auto mb-1.5" />
                  <p className="text-caption text-muted-foreground">Clique para selecionar</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">PDF, DOCX, JPG, PNG até 20MB</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setUploadFile(f);
                if (f && !uploadName) setUploadName(f.name.replace(/\.[^.]+$/, ""));
                e.target.value = "";
              }} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-overline text-muted-foreground block mb-1">Categoria *</label>
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger className="bg-muted border-border rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.filter((c) => c.value !== "__all__").map((c) => (
                      <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1">Vincular a Evento</label>
                <Select value={uploadEventId} onValueChange={setUploadEventId}>
                  <SelectTrigger className="bg-muted border-border rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">Nenhum</SelectItem>
                    {processEvents.map((ev: any) => (
                      <SelectItem key={ev.id} value={ev.id} className="text-xs">
                        {ev.title} ({new Date(ev.event_date).toLocaleDateString("pt-BR")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-overline text-muted-foreground block mb-1">Nome do documento</label>
              <Input className="bg-muted border-border rounded-xl h-9 text-xs" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="Nome do arquivo" />
            </div>

            <div>
              <label className="text-overline text-muted-foreground block mb-1">Descrição (opcional)</label>
              <Textarea className="bg-muted border-border rounded-xl text-xs" value={uploadNotes} onChange={(e) => setUploadNotes(e.target.value)} rows={2} placeholder="Observações sobre o documento..." />
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowUploadDialog(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleUpload} disabled={!uploadFile || uploading}>
                {uploading ? "Enviando..." : "Anexar"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link existing doc dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Vincular Documento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar documentos não vinculados..."
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            {unlinkedDocs.length === 0 ? (
              <p className="text-caption text-muted-foreground text-center py-6">Nenhum documento sem vínculo encontrado.</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {unlinkedDocs.map((doc: any) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => linkMutation.mutate(doc.id)}
                  >
                    <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="flex-1 text-caption truncate">{doc.file_name}</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                      {CATEGORY_OPTIONS.find((c) => c.value === doc.category)?.label || doc.category}
                    </Badge>
                    <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ─── Linked Deadlines ─── */
const DEADLINE_STATUS_MAP: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "warning" },
  completed: { label: "Concluído", variant: "success" },
  overdue: { label: "Vencido", variant: "destructive" },
};

const LinkedDeadlinesSection = ({ deadlines, loading, processId }: { deadlines: any[]; loading: boolean; processId: string }) => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newDescription, setNewDescription] = useState("");

  const { data: unlinkedDeadlines = [] } = useQuery({
    queryKey: ["unlinked-deadlines-for-process", activeOrgId, linkSearch],
    queryFn: async () => {
      let q = supabase
        .from("deadlines")
        .select("id, title, due_date, priority, status")
        .is("process_id", null)
        .order("due_date", { ascending: true })
        .limit(20);
      if (linkSearch) q = q.ilike("title", `%${linkSearch}%`);
      const { data } = await q;
      return (data as any[]) || [];
    },
    enabled: showLinkDialog,
  });

  const linkMutation = useMutation({
    mutationFn: async (deadlineId: string) => {
      const { error } = await supabase.from("deadlines").update({ process_id: processId } as any).eq("id", deadlineId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-linked-deadlines", processId] });
      queryClient.invalidateQueries({ queryKey: ["unlinked-deadlines-for-process"] });
      toast.success("Prazo vinculado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unlinkMutation = useMutation({
    mutationFn: async (deadlineId: string) => {
      const { error } = await supabase.from("deadlines").update({ process_id: null } as any).eq("id", deadlineId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-linked-deadlines", processId] });
      toast.success("Prazo desvinculado.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user || !newTitle.trim() || !newDueDate) throw new Error("Preencha título e data.");
      const { error } = await supabase.from("deadlines").insert({
        user_id: user.id,
        organization_id: activeOrgId,
        title: newTitle.trim(),
        due_date: newDueDate,
        priority: newPriority,
        description: newDescription || null,
        process_id: processId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-linked-deadlines", processId] });
      queryClient.invalidateQueries({ queryKey: ["deadlines"] });
      setShowCreateDialog(false);
      setNewTitle("");
      setNewDueDate("");
      setNewPriority("medium");
      setNewDescription("");
      toast.success("Prazo criado e vinculado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isOverdue = (dueDate: string, status: string) => {
    if (status === "completed") return false;
    return new Date(dueDate + "T23:59:59") < new Date();
  };

  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <span className="text-overline text-muted-foreground">Prazos vinculados</span>
        </div>
        <div className="flex items-center gap-1.5">
          {deadlines.length > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {deadlines.length} prazo{deadlines.length !== 1 ? "s" : ""}
            </span>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Vincular prazo existente" onClick={() => setShowLinkDialog(true)}>
            <Link2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Criar novo prazo" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-caption text-muted-foreground text-center py-4">Carregando prazos...</p>
      ) : deadlines.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-caption text-muted-foreground mb-2">Nenhum prazo vinculado.</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setShowLinkDialog(true)}>
              <Link2 className="h-3 w-3 mr-1" /> Vincular existente
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-3 w-3 mr-1" /> Criar novo
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {deadlines.map((dl: any) => {
            const overdue = isOverdue(dl.due_date, dl.status);
            const statusInfo = DEADLINE_STATUS_MAP[overdue ? "overdue" : dl.status] || DEADLINE_STATUS_MAP.pending;
            return (
              <div key={dl.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                {overdue ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                ) : dl.status === "completed" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-warning shrink-0" />
                )}
                <span className={`flex-1 text-caption truncate ${dl.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {dl.title}
                </span>
                <div className={`h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT[dl.priority] || PRIORITY_DOT.medium}`} title={dl.priority} />
                <span className={`text-[10px] shrink-0 ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {new Date(dl.due_date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </span>
                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${overdue ? "border-destructive text-destructive" : ""}`}>
                  {statusInfo.label}
                </Badge>
                <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive shrink-0" title="Desvincular" onClick={() => unlinkMutation.mutate(dl.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Link existing deadline dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Vincular Prazo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar prazos não vinculados..." value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} className="pl-9 h-9 text-sm" />
            </div>
            {unlinkedDeadlines.length === 0 ? (
              <p className="text-caption text-muted-foreground text-center py-6">Nenhum prazo sem vínculo encontrado.</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {unlinkedDeadlines.map((dl: any) => (
                  <div key={dl.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => linkMutation.mutate(dl.id)}>
                    <CalendarClock className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="flex-1 text-caption truncate">{dl.title}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(dl.due_date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </span>
                    <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create new deadline dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Novo Prazo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-overline text-muted-foreground block mb-1">Título *</label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex: Audiência inicial" className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1">Data de vencimento *</label>
              <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1">Prioridade</label>
              <Select value={newPriority} onValueChange={setNewPriority}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1">Descrição</label>
              <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Descrição opcional..." className="h-9 text-sm" />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
              <Button size="sm" onClick={() => createMutation.mutate()} disabled={!newTitle.trim() || !newDueDate || createMutation.isPending}>
                {createMutation.isPending ? "Criando..." : "Criar Prazo"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ─── Court Sync Section ─── */
const courtSystemLabels: Record<string, string> = { pje: "PJe", esaj: "e-SAJ", projudi: "PROJUDI", eproc: "e-Proc", tucujuris: "Tucujuris" };
const importStatusLabels: Record<string, { label: string; className: string }> = {
  sucesso: { label: "Sucesso", className: "text-accent" },
  falha: { label: "Falha", className: "text-destructive" },
  sem_novidades: { label: "Sem novidades", className: "text-muted-foreground" },
  pending: { label: "Pendente", className: "text-warning" },
};

const CourtSyncSection = ({ processId, processNumber }: { processId: string; processNumber: string }) => {
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  // Check existing integration
  const { data: integration } = useQuery({
    queryKey: ["court-integration-for-process", processId],
    queryFn: async () => {
      const { data } = await supabase
        .from("court_integrations")
        .select("id, court_system, status, last_sync_at, sync_config")
        .eq("process_id", processId)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
    enabled: !!processId,
  });

  // Fetch import logs
  const { data: importLogs = [] } = useQuery({
    queryKey: ["import-logs-for-process", processId],
    queryFn: async () => {
      const { data } = await supabase
        .from("import_logs" as any)
        .select("*")
        .eq("process_id", processId)
        .order("created_at", { ascending: false })
        .limit(5);
      return (data as any[]) || [];
    },
    enabled: !!processId,
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("court-sync", {
        body: { process_id: processId, source: "manual" },
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["court-integration-for-process", processId] });
      queryClient.invalidateQueries({ queryKey: ["import-logs-for-process", processId] });
      queryClient.invalidateQueries({ queryKey: ["process-movements", processId] });

      if (data?.movements_created > 0) {
        toast.success(`Processo atualizado com sucesso! ${data.movements_created} movimentação(ões) importada(s).`);
      } else if (data?.movements_found === 0) {
        toast.info("Consulta realizada. Nenhuma novidade encontrada.");
      } else {
        toast.info("Consulta realizada. Nenhuma movimentação nova.");
      }
    } catch (err: any) {
      toast.error("Não foi possível consultar o tribunal: " + (err.message || "Tente novamente mais tarde."));
    } finally {
      setSyncing(false);
    }
  };

  // Check if number looks valid for sync (at least some digits)
  const hasValidNumber = processNumber && processNumber.replace(/\D/g, "").length >= 10;

  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="text-overline text-muted-foreground">Importação do Tribunal</span>
        </div>
        {integration && (
          <LexBadge variant="outline">{courtSystemLabels[integration.court_system] || integration.court_system}</LexBadge>
        )}
      </div>

      {!hasValidNumber ? (
        <p className="text-caption text-muted-foreground text-center py-4">
          Número do processo inválido ou ausente para consulta automática.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg gap-1.5"
              disabled={syncing}
              onClick={handleSync}
            >
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              {syncing ? "Consultando tribunal..." : "Atualizar do tribunal"}
            </Button>
            {integration?.last_sync_at && (
              <span className="text-[10px] text-muted-foreground">
                Última consulta: {new Date(integration.last_sync_at).toLocaleString("pt-BR")}
              </span>
            )}
          </div>

          {/* Import logs */}
          {importLogs.length > 0 && (
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {importLogs.map((log: any) => {
                const st = importStatusLabels[log.status] || importStatusLabels.pending;
                return (
                  <div key={log.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/30">
                    <span className={`text-caption font-medium ${st.className}`}>{st.label}</span>
                    <span className="flex-1 text-caption text-muted-foreground truncate">{log.message}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(log.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Process Details with Linked Tasks ─── */
const TASK_STATUS_ICON: Record<string, React.ReactNode> = {
  todo: <Circle className="h-3.5 w-3.5 text-muted-foreground" />,
  in_progress: <Clock className="h-3.5 w-3.5 text-warning" />,
  done: <CheckCircle2 className="h-3.5 w-3.5 text-accent" />,
};
const TASK_STATUS_LABEL: Record<string, string> = { todo: "A fazer", in_progress: "Em progresso", done: "Concluído" };
const PRIORITY_DOT: Record<string, string> = { urgent: "bg-destructive", high: "bg-warning", medium: "bg-muted-foreground", low: "bg-muted-foreground/40" };

const ProcessDetailsContent = ({ process, getMemberName, activeOrgId }: { process: any; getMemberName: (id: string) => string; activeOrgId: string | null }) => {
  const { data: linkedTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["process-linked-tasks", process.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_tasks")
        .select("id, title, status, priority, due_date, assigned_to, done")
        .eq("process_id", process.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!process.id,
  });

  const { data: linkedDocs = [], isLoading: docsLoading } = useQuery({
    queryKey: ["process-linked-docs", process.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, file_name, file_type, file_size, file_url, created_at, category, event_id, origin, notes")
        .eq("process_id", process.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!process.id,
  });

  const { data: linkedDeadlines = [], isLoading: deadlinesLoading } = useQuery({
    queryKey: ["process-linked-deadlines", process.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deadlines")
        .select("id, title, due_date, priority, status, description")
        .eq("process_id", process.id)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!process.id,
  });

  const doneCount = linkedTasks.filter((t: any) => t.status === "done").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-body-sm">
        <div><span className="text-overline text-muted-foreground block mb-0.5">Número</span><span className="font-mono text-primary">{process.number}</span></div>
        <div><span className="text-overline text-muted-foreground block mb-0.5">Cliente</span>{process.client_name}</div>
        <div><span className="text-overline text-muted-foreground block mb-0.5">Título</span>{process.title}</div>
        <div><span className="text-overline text-muted-foreground block mb-0.5">Tipo</span>{typeMap[process.type] || process.type}</div>
        <div><span className="text-overline text-muted-foreground block mb-0.5">Status</span><LexBadge variant={process.status === "active" ? "success" : "warning"}>{statusMap[process.status]}</LexBadge></div>
        <div><span className="text-overline text-muted-foreground block mb-0.5">Risco</span><RiskIndicator level={process.risk_level || "low"} /></div>
        {process.responsible_id && (
          <div><span className="text-overline text-muted-foreground block mb-0.5">Responsável</span>
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5"><AvatarFallback className="text-[10px]">{getMemberName(process.responsible_id).charAt(0)}</AvatarFallback></Avatar>
              <span>{getMemberName(process.responsible_id)}</span>
            </div>
          </div>
        )}
        {process.foro && <div><span className="text-overline text-muted-foreground block mb-0.5">Foro</span>{process.foro}</div>}
        {process.vara && <div><span className="text-overline text-muted-foreground block mb-0.5">Vara</span>{process.vara}</div>}
        {process.classe && <div><span className="text-overline text-muted-foreground block mb-0.5">Classe</span>{process.classe}</div>}
        {process.fase && <div><span className="text-overline text-muted-foreground block mb-0.5">Fase</span><LexBadge variant="outline">{process.fase}</LexBadge></div>}
        {process.valor_causa != null && <div><span className="text-overline text-muted-foreground block mb-0.5">Valor da Causa</span>R$ {Number(process.valor_causa).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>}
        {process.court && <div><span className="text-overline text-muted-foreground block mb-0.5">Vara/Tribunal</span>{process.court}</div>}
        {process.judge && <div><span className="text-overline text-muted-foreground block mb-0.5">Juiz</span>{process.judge}</div>}
      </div>
      {/* Partes */}
      {process.partes && ((process.partes as any).autores?.length > 0 || (process.partes as any).reus?.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {(process.partes as any).autores?.length > 0 && (
            <div><span className="text-overline text-muted-foreground block mb-1">Autor(es)</span>
              <div className="flex flex-wrap gap-1.5">{(process.partes as any).autores.map((a: string) => <LexBadge key={a} variant="default">{a}</LexBadge>)}</div>
            </div>
          )}
          {(process.partes as any).reus?.length > 0 && (
            <div><span className="text-overline text-muted-foreground block mb-1">Réu(s)</span>
              <div className="flex flex-wrap gap-1.5">{(process.partes as any).reus.map((r: string) => <LexBadge key={r} variant="outline">{r}</LexBadge>)}</div>
            </div>
          )}
        </div>
      )}
      {/* Assuntos */}
      {process.assunto?.length > 0 && (
        <div><span className="text-overline text-muted-foreground block mb-1">Assunto(s)</span>
          <div className="flex flex-wrap gap-1.5">{process.assunto.map((a: string) => <LexBadge key={a} variant="outline">{a}</LexBadge>)}</div>
        </div>
      )}
      {process.description && <div><span className="text-overline text-muted-foreground block mb-1">Descrição</span><p className="text-body-sm rounded-xl bg-muted p-3">{process.description}</p></div>}
      {process.tags?.length > 0 && (
        <div><span className="text-overline text-muted-foreground block mb-1">Tags</span>
          <div className="flex flex-wrap gap-1.5">
            {process.tags.map((tag: string) => <LexBadge key={tag} variant="outline">{tag}</LexBadge>)}
          </div>
        </div>
      )}
      {process.notes && <div><span className="text-overline text-muted-foreground block mb-1">Observações</span><p className="text-body-sm rounded-xl bg-muted p-3">{process.notes}</p></div>}

      {/* Linked Tasks */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" />
            <span className="text-overline text-muted-foreground">Tarefas vinculadas</span>
          </div>
          {linkedTasks.length > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {doneCount}/{linkedTasks.length} concluídas
            </span>
          )}
        </div>
        {tasksLoading ? (
          <p className="text-caption text-muted-foreground text-center py-4">Carregando tarefas...</p>
        ) : linkedTasks.length === 0 ? (
          <p className="text-caption text-muted-foreground text-center py-4">Nenhuma tarefa vinculada a este processo.</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {linkedTasks.map((task: any) => (
              <div key={task.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                {TASK_STATUS_ICON[task.status] || TASK_STATUS_ICON.todo}
                <span className={`flex-1 text-caption truncate ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {task.title}
                </span>
                <div className={`h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT[task.priority] || PRIORITY_DOT.medium}`} title={task.priority} />
                {task.due_date && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(task.due_date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                )}
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                  {TASK_STATUS_LABEL[task.status] || task.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linked Deadlines */}
      <LinkedDeadlinesSection deadlines={linkedDeadlines} loading={deadlinesLoading} processId={process.id} />

      {/* Linked Documents */}
      <LinkedDocsSection docs={linkedDocs} loading={docsLoading} processId={process.id} />

      {/* Resumo 360 (RF-043) */}
      <ProcessSummary360 processId={process.id} organizationId={activeOrgId || ""} />

      {/* AI Classification */}
      <ProcessClassification processId={process.id} organizationId={activeOrgId || ""} />

      {/* Decision Extraction */}
      <DecisionExtraction processId={process.id} organizationId={activeOrgId || ""} />

      {/* Court Sync */}
      <CourtSyncSection processId={process.id} processNumber={process.number} />

      {/* Previsão Processual (RF-070/071/072) */}
      <ProcessPredictionsPanel processId={process.id} organizationId={activeOrgId || ""} />

      {/* Linha do Tempo */}
      <ProcessTimeline processId={process.id} />

      {/* Movimentações */}
      <ProcessMovements processId={process.id} />

      {/* Chat */}
      <ProcessChat processId={process.id} />
    </div>
  );
};
