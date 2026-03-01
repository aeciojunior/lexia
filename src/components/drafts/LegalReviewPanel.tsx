import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { X, Loader2, CheckCheck, Check, Ban, AlertTriangle, Info, AlertCircle, Columns2 } from "lucide-react";

const REVIEW_MODES = [
  { value: "automatico", label: "Automático", desc: "Revisão completa em todas as camadas" },
  { value: "assistido", label: "Assistido", desc: "Sugestões detalhadas com explicações" },
  { value: "tecnico", label: "Técnico", desc: "Foco em precisão jurídica" },
  { value: "linguistico", label: "Linguístico", desc: "Foco em gramática e clareza" },
  { value: "organizacional", label: "Organizacional", desc: "Harmonização de estilo" },
];

const TYPE_LABELS: Record<string, string> = {
  linguistic: "Linguística",
  clarity: "Clareza",
  cohesion: "Coesão",
  technical: "Técnica Jurídica",
};

const SEVERITY_CONFIG: Record<string, { icon: typeof Info; color: string; label: string }> = {
  info: { icon: Info, color: "text-blue-500", label: "Info" },
  warning: { icon: AlertTriangle, color: "text-yellow-500", label: "Atenção" },
  error: { icon: AlertCircle, color: "text-destructive", label: "Erro" },
};

interface Suggestion {
  type: string;
  severity: string;
  original: string;
  suggestion: string;
  explanation: string;
  category: string;
}

interface LegalReviewPanelProps {
  draftId: string;
  draftContent: string;
  pieceType?: string;
  onApply: (original: string, replacement: string) => void;
  onClose: () => void;
}

export default function LegalReviewPanel({ draftId, draftContent, pieceType, onApply, onClose }: LegalReviewPanelProps) {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { toast } = useToast();

  const [mode, setMode] = useState("automatico");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ summary: string; score: number; suggestions: Suggestion[] } | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [applied, setApplied] = useState<Set<number>>(new Set());

  const handleReview = async () => {
    if (!activeOrgId || !draftContent) return;
    setLoading(true);
    setResult(null);
    setDismissed(new Set());
    setApplied(new Set());

    try {
      const { data, error } = await supabase.functions.invoke("review-legal", {
        body: {
          organization_id: activeOrgId,
          draft_id: draftId,
          review_mode: mode,
          content: draftContent,
          piece_type: pieceType,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult(data);

      // Audit: suggestions generated
      await supabase.from("audit_logs").insert({
        action: "legal_review_suggestion_generated",
        user_id: user?.id || null,
        organization_id: activeOrgId,
        resource_type: "legal_review",
        resource_id: draftId,
        metadata: { review_mode: mode, suggestion_count: data.suggestions?.length || 0 },
      } as any);

      toast({ title: `Revisão concluída — Score: ${data.score}/100` });
    } catch (e: any) {
      toast({ title: "Erro na revisão", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (idx: number, s: Suggestion) => {
    onApply(s.original, s.suggestion);
    setApplied(prev => new Set(prev).add(idx));

    // Audit
    await supabase.from("audit_logs").insert({
      action: "legal_review_change_applied",
      user_id: user?.id || null,
      organization_id: activeOrgId,
      resource_type: "legal_review",
      resource_id: draftId,
      metadata: { type: s.type, category: s.category, severity: s.severity },
    } as any);
  };

  const handleDismiss = (idx: number) => {
    setDismissed(prev => new Set(prev).add(idx));
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-destructive";
  };

  const grouped = result?.suggestions.reduce((acc, s, idx) => {
    if (dismissed.has(idx) || applied.has(idx)) return acc;
    (acc[s.type] = acc[s.type] || []).push({ ...s, _idx: idx });
    return acc;
  }, {} as Record<string, (Suggestion & { _idx: number })[]>);

  return (
    <div className="w-full lg:w-96 shrink-0 border-l border-border bg-card">
      <div className="p-4 flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <CheckCheck className="h-4 w-4 text-primary" /> Revisão Jurídica
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Separator />

      <div className="p-4 space-y-3">
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REVIEW_MODES.map(m => (
              <SelectItem key={m.value} value={m.value}>
                <div>
                  <span className="font-medium">{m.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{m.desc}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleReview} disabled={loading} className="w-full gap-2" size="sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
          {loading ? "Revisando..." : "Iniciar Revisão"}
        </Button>
      </div>

      {result && (
        <>
          <Separator />
          <div className="p-4 space-y-3">
            {/* Score */}
            <div className="flex items-center gap-3">
              <div className={`text-3xl font-bold ${scoreColor(result.score)}`}>{result.score}</div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Qualidade geral</p>
                <Progress value={result.score} className="h-2 mt-1" />
              </div>
            </div>

            {/* Summary */}
            <p className="text-xs text-muted-foreground leading-relaxed">{result.summary}</p>

            {/* Stats */}
            <div className="flex gap-2 text-xs">
              <Badge variant="outline" className="gap-1">
                {result.suggestions.length} sugestões
              </Badge>
              <Badge variant="destructive" className="gap-1">
                {result.suggestions.filter(s => s.severity === "error").length} erros
              </Badge>
              <Badge variant="secondary" className="gap-1">
                {applied.size} aplicadas
              </Badge>
            </div>
          </div>

          <Separator />

          <ScrollArea className="h-[calc(100vh-480px)]">
            <div className="p-4 space-y-4">
              {grouped && Object.entries(grouped).map(([type, items]) => (
                <div key={type}>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {TYPE_LABELS[type] || type} ({items.length})
                  </h4>
                  <div className="space-y-2">
                    {items.map((s) => {
                      const sev = SEVERITY_CONFIG[s.severity] || SEVERITY_CONFIG.info;
                      const SevIcon = sev.icon;
                      return (
                        <Card key={s._idx} className="overflow-hidden">
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <SevIcon className={`h-4 w-4 mt-0.5 shrink-0 ${sev.color}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Badge variant="outline" className="text-[10px]">{s.category}</Badge>
                                  <span className={`text-[10px] font-medium ${sev.color}`}>{sev.label}</span>
                                </div>
                                <p className="text-xs line-through text-muted-foreground">{s.original}</p>
                                <p className="text-xs font-medium text-foreground mt-1">{s.suggestion}</p>
                                <p className="text-[11px] text-muted-foreground mt-1.5 italic">{s.explanation}</p>
                              </div>
                            </div>
                            <div className="flex gap-1.5 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => handleDismiss(s._idx)}
                              >
                                <Ban className="h-3 w-3" /> Ignorar
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => handleApply(s._idx, s)}
                              >
                                <Check className="h-3 w-3" /> Aplicar
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}

              {grouped && Object.keys(grouped).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Todas as sugestões foram processadas ✓
                </p>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
