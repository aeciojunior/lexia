import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import ArgumentSuggestionsPanel from "@/components/drafts/ArgumentSuggestionsPanel";
import LegalReviewPanel from "@/components/drafts/LegalReviewPanel";
import DiffView from "@/components/drafts/DiffView";
import {
  Plus, FileText, Wand2, Copy, Download, History, RefreshCw, Loader2, Sparkles, Save, Lightbulb, Lock, CheckCheck,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PIECE_TYPES = [
  { value: "peticao_inicial", label: "Petição Inicial" },
  { value: "contestacao", label: "Contestação" },
  { value: "recurso", label: "Recurso" },
  { value: "manifestacao", label: "Manifestação" },
  { value: "memorial", label: "Memorial" },
  { value: "contrato", label: "Contrato" },
  { value: "parecer", label: "Parecer" },
  { value: "notificacao_extrajudicial", label: "Notificação Extrajudicial" },
  { value: "peca_administrativa", label: "Peça Administrativa" },
  { value: "personalizada", label: "Personalizada" },
];

const STYLES = [
  { value: "juridico_formal", label: "Jurídico Formal" },
  { value: "executivo", label: "Executivo" },
  { value: "tecnico", label: "Técnico" },
  { value: "objetivo", label: "Objetivo" },
];

const DETAIL_LEVELS = [
  { value: "curto", label: "Curto" },
  { value: "medio", label: "Médio" },
  { value: "completo", label: "Completo" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  final: "bg-primary/10 text-primary",
  archived: "bg-destructive/10 text-destructive",
};

export default function Drafts() {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [pieceType, setPieceType] = useState("peticao_inicial");
  const [style, setStyle] = useState("juridico_formal");
  const [detailLevel, setDetailLevel] = useState("completo");
  const [processId, setProcessId] = useState("");
  const [instructions, setInstructions] = useState("");
  const [rewriteInstructions, setRewriteInstructions] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [diffOriginal, setDiffOriginal] = useState("");

  // Fetch drafts
  const { data: drafts, isLoading } = useQuery({
    queryKey: ["drafts", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drafts")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  // Fetch processes for select
  const { data: processes } = useQuery({
    queryKey: ["processes-select", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processes")
        .select("id, title, number")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  // Fetch versions for a draft
  const { data: versions } = useQuery({
    queryKey: ["draft-versions", selectedDraft?.id, activeOrgId],
    queryFn: async () => {
      if (!selectedDraft?.id) return [];
      // Get all versions by walking parent chain + same process/type
      const { data, error } = await supabase
        .from("drafts")
        .select("id, version, title, piece_type, style, created_at, content")
        .eq("organization_id", activeOrgId!)
        .or(`id.eq.${selectedDraft.id},parent_version_id.eq.${selectedDraft.id}`)
        .order("version", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedDraft?.id && showVersions,
  });

  const streamGenerate = useCallback(async (params: {
    process_id?: string;
    piece_type: string;
    style: string;
    detail_level: string;
    instructions?: string;
    rewrite_content?: string;
    rewrite_instructions?: string;
  }) => {
    setIsStreaming(true);
    setStreamContent("");

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-draft`;
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          organization_id: activeOrgId,
          ...params,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Erro na geração");
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              setStreamContent(fullContent);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      return fullContent;
    } finally {
      setIsStreaming(false);
    }
  }, [activeOrgId]);

  const handleGenerate = async () => {
    if (!title.trim()) {
      toast({ title: "Título obrigatório", variant: "destructive" });
      return;
    }

    try {
      const content = await streamGenerate({
        process_id: processId || undefined,
        piece_type: pieceType,
        style,
        detail_level: detailLevel,
        instructions: instructions || undefined,
      });

      if (content) {
        // Save to database
        const { data, error } = await supabase.from("drafts").insert({
          organization_id: activeOrgId!,
          user_id: user!.id,
          title,
          piece_type: pieceType,
          style,
          detail_level: detailLevel,
          process_id: processId || null,
          instructions,
          content,
          status: "draft",
          ai_model: "google/gemini-3-flash-preview",
        }).select().single();

        if (error) throw error;

        toast({ title: "Minuta gerada com sucesso!" });
        setSelectedDraft(data);
        setShowGenerate(false);
        queryClient.invalidateQueries({ queryKey: ["drafts"] });
        resetForm();
      }
    } catch (e: any) {
      toast({ title: "Erro ao gerar minuta", description: e.message, variant: "destructive" });
    }
  };

  const handleRewrite = async () => {
    if (!selectedDraft || !rewriteInstructions.trim()) return;

    try {
      const content = await streamGenerate({
        process_id: selectedDraft.process_id || undefined,
        piece_type: selectedDraft.piece_type,
        style: selectedDraft.style,
        detail_level: selectedDraft.detail_level,
        rewrite_content: selectedDraft.content,
        rewrite_instructions: rewriteInstructions,
      });

      if (content) {
        const { data, error } = await supabase.from("drafts").insert({
          organization_id: activeOrgId!,
          user_id: user!.id,
          title: selectedDraft.title,
          piece_type: selectedDraft.piece_type,
          style: selectedDraft.style,
          detail_level: selectedDraft.detail_level,
          process_id: selectedDraft.process_id,
          instructions: rewriteInstructions,
          content,
          version: (selectedDraft.version || 1) + 1,
          parent_version_id: selectedDraft.id,
          status: "draft",
          ai_model: "google/gemini-3-flash-preview",
        }).select().single();

        if (error) throw error;

        toast({ title: "Minuta reescrita com sucesso!" });
        setSelectedDraft(data);
        setRewriteInstructions("");
        queryClient.invalidateQueries({ queryKey: ["drafts"] });
      }
    } catch (e: any) {
      toast({ title: "Erro ao reescrever", description: e.message, variant: "destructive" });
    }
  };

  const handleCopy = () => {
    if (selectedDraft?.content) {
      navigator.clipboard.writeText(selectedDraft.content);
      toast({ title: "Copiado para a área de transferência" });
    }
  };

  const handleExportPdf = async () => {
    if (!selectedDraft?.content) return;
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const lines = doc.splitTextToSize(selectedDraft.content, 170);
    let y = 20;
    doc.setFontSize(10);
    for (const line of lines) {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, 20, y);
      y += 5;
    }
    doc.save(`${selectedDraft.title || "minuta"}.pdf`);
    toast({ title: "PDF exportado!" });
  };

  const handleSaveToVault = async () => {
    if (!selectedDraft?.content || !activeOrgId || !user) return;
    try {
      const blob = new Blob([selectedDraft.content], { type: "text/markdown" });
      const fileName = `${(selectedDraft.title || "minuta").replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "")}.md`;
      const path = `${activeOrgId}/${crypto.randomUUID()}_${fileName}`;

      const { error: uploadError } = await supabase.storage.from("vault").upload(path, blob);
      if (uploadError) throw uploadError;

      const { error } = await supabase.from("vault_documents").insert({
        organization_id: activeOrgId,
        title: selectedDraft.title || "Minuta",
        file_name: fileName,
        file_url: path,
        file_size: blob.size,
        file_type: "text/markdown",
        category: "confidential",
        description: `Minuta: ${pieceLabel(selectedDraft.piece_type)} — v${selectedDraft.version}`,
        uploaded_by: user.id,
      });
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        action: "secure_document_uploaded",
        user_id: user.id,
        organization_id: activeOrgId,
        resource_type: "vault_document",
        resource_id: selectedDraft.id,
        metadata: { source: "draft", draft_id: selectedDraft.id, file_name: fileName },
      });

      toast({ title: "Minuta salva no Cofre Seguro 🔒" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar no cofre", description: e.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setTitle("");
    setPieceType("peticao_inicial");
    setStyle("juridico_formal");
    setDetailLevel("completo");
    setProcessId("");
    setInstructions("");
  };

  const pieceLabel = (v: string) => PIECE_TYPES.find(p => p.value === v)?.label || v;

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 h-full">
      {/* Left: List */}
      <div className="w-full lg:w-80 shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Minutas</h1>
          <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Nova
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-secondary" /> Gerar Minuta com IA
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Título</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Petição Inicial – Processo 123" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo de Peça</Label>
                    <Select value={pieceType} onValueChange={setPieceType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PIECE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Estilo</Label>
                    <Select value={style} onValueChange={setStyle}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STYLES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nível de Detalhe</Label>
                    <Select value={detailLevel} onValueChange={setDetailLevel}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DETAIL_LEVELS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Processo (opcional)</Label>
                    <Select value={processId} onValueChange={setProcessId}>
                      <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {processes?.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.number || p.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Instruções adicionais</Label>
                  <Textarea value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Descreva detalhes ou orientações para a IA..." rows={3} />
                </div>
                <Button onClick={handleGenerate} disabled={isStreaming} className="w-full gap-2">
                  {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {isStreaming ? "Gerando..." : "Gerar Minuta"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-2 pr-2">
            {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            {drafts?.map(draft => (
              <Card
                key={draft.id}
                className={`cursor-pointer transition-all hover:shadow-md ${selectedDraft?.id === draft.id ? "ring-2 ring-primary" : ""}`}
                onClick={() => { setSelectedDraft(draft); setStreamContent(""); }}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{draft.title || "Sem título"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{pieceLabel(draft.piece_type)}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_COLORS[draft.status] || ""}`}>
                      v{draft.version}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {format(new Date(draft.updated_at), "dd MMM yyyy HH:mm", { locale: ptBR })}
                  </p>
                </CardContent>
              </Card>
            ))}
            {!isLoading && (!drafts || drafts.length === 0) && (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhuma minuta ainda</p>
                <p className="text-xs">Clique em "Nova" para gerar</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right: Preview */}
      <div className="flex-1 min-w-0">
        {(selectedDraft || isStreaming) ? (
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-lg">{selectedDraft?.title || "Gerando..."}</CardTitle>
                  {selectedDraft && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {pieceLabel(selectedDraft.piece_type)} • {STYLES.find(s => s.value === selectedDraft.style)?.label} • v{selectedDraft.version}
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Button variant="ghost" size="icon" onClick={() => { setShowReview(!showReview); if (!showReview) setShowSuggestions(false); }} title="Revisão Jurídica"><CheckCheck className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { setShowSuggestions(!showSuggestions); if (!showSuggestions) setShowReview(false); }} title="Sugestões IA"><Lightbulb className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={handleCopy} title="Copiar"><Copy className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={handleExportPdf} title="Exportar PDF"><Download className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={handleSaveToVault} title="Salvar no Cofre"><Lock className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setShowVersions(true)} title="Versões"><History className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 overflow-hidden pt-4">
              <ScrollArea className="h-[calc(100vh-380px)]">
                <div className="prose prose-sm dark:prose-invert max-w-none pr-4">
                  <ReactMarkdown>
                    {isStreaming ? streamContent : selectedDraft?.content || ""}
                  </ReactMarkdown>
                  {isStreaming && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />}
                </div>
              </ScrollArea>
            </CardContent>
            <Separator />
            {/* Rewrite bar */}
            {selectedDraft && !isStreaming && (
              <div className="p-3 flex gap-2">
                <Input
                  value={rewriteInstructions}
                  onChange={e => setRewriteInstructions(e.target.value)}
                  placeholder="Instruções para reescrita (ex: mais formal, adicionar jurisprudência...)"
                  className="flex-1"
                  onKeyDown={e => e.key === "Enter" && handleRewrite()}
                />
                <Button onClick={handleRewrite} disabled={isStreaming || !rewriteInstructions.trim()} size="sm" className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" /> Reescrever
                </Button>
              </div>
            )}
          </Card>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">Geração de Minutas com IA</p>
              <p className="text-sm mt-1">Selecione uma minuta ou crie uma nova</p>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions Panel */}
      {showSuggestions && selectedDraft && (
        <ArgumentSuggestionsPanel
          draftId={selectedDraft.id}
          processId={selectedDraft.process_id || undefined}
          pieceType={selectedDraft.piece_type}
          onInsert={(content) => {
            const updated = { ...selectedDraft, content: (selectedDraft.content || "") + "\n\n" + content };
            setSelectedDraft(updated);
            supabase.from("drafts").update({ content: updated.content }).eq("id", updated.id);
          }}
          onClose={() => setShowSuggestions(false)}
        />
      )}

      {/* Legal Review Panel */}
      {showReview && selectedDraft && (
        <LegalReviewPanel
          draftId={selectedDraft.id}
          draftContent={selectedDraft.content || ""}
          pieceType={selectedDraft.piece_type}
          onApply={(original, replacement) => {
            const newContent = (selectedDraft.content || "").replace(original, replacement);
            const updated = { ...selectedDraft, content: newContent };
            setSelectedDraft(updated);
            supabase.from("drafts").update({ content: newContent }).eq("id", updated.id);
          }}
          onClose={() => setShowReview(false)}
        />
      )}

      {/* Versions Dialog */}
      <Dialog open={showVersions} onOpenChange={setShowVersions}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Histórico de Versões</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            <div className="space-y-2">
              {versions?.map(v => (
                <Card
                  key={v.id}
                  className={`cursor-pointer hover:shadow-sm ${v.id === selectedDraft?.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => { setSelectedDraft(v); setShowVersions(false); }}
                >
                  <CardContent className="p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">v{v.version} — {v.title}</span>
                      <Badge variant="outline" className="text-[10px]">{pieceLabel(v.piece_type)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(v.created_at), "dd/MM/yyyy HH:mm")}
                    </p>
                  </CardContent>
                </Card>
              ))}
              {(!versions || versions.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma versão encontrada</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
