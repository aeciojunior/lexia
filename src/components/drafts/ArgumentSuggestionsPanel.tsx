import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Loader2, Sparkles, ChevronDown, ChevronRight, Plus, Shield, Scale, FileSearch, Gavel, X,
} from "lucide-react";

const SUGGESTION_TABS = [
  { value: "argument", label: "Argumentos", icon: Scale },
  { value: "counter_argument", label: "Contra-Args", icon: Shield },
  { value: "request", label: "Pedidos", icon: Gavel },
  { value: "legal_basis", label: "Fundamentos", icon: FileSearch },
  { value: "evidence", label: "Provas", icon: FileSearch },
] as const;

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-500/10 text-green-700 dark:text-green-400",
  medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  high: "bg-destructive/10 text-destructive",
};

const RISK_LABELS: Record<string, string> = {
  low: "Baixo risco",
  medium: "Médio risco",
  high: "Alto risco",
};

interface Suggestion {
  id?: string;
  title: string;
  content: string;
  legal_basis?: string;
  jurisprudence?: string;
  risk_level: string;
  strength_score: number;
  category: string;
  status?: string;
}

interface Props {
  draftId?: string;
  processId?: string;
  pieceType?: string;
  onInsert: (content: string) => void;
  onClose: () => void;
}

export default function ArgumentSuggestionsPanel({ draftId, processId, pieceType, onInsert, onClose }: Props) {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("argument");
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [localSuggestions, setLocalSuggestions] = useState<Record<string, Suggestion[]>>({});

  // Fetch persisted suggestions
  const { data: savedSuggestions } = useQuery({
    queryKey: ["argument-suggestions", draftId, activeOrgId],
    queryFn: async () => {
      if (!draftId || !activeOrgId) return [];
      const { data, error } = await supabase
        .from("argument_suggestions")
        .select("*")
        .eq("organization_id", activeOrgId)
        .eq("draft_id", draftId)
        .order("strength_score", { ascending: false });
      if (error) throw error;
      return data as Suggestion[];
    },
    enabled: !!draftId && !!activeOrgId,
  });

  const allSuggestions = [
    ...(savedSuggestions || []),
    ...(localSuggestions[activeTab] || []),
  ].filter((s) => (s as any).suggestion_type === activeTab || (!("suggestion_type" in s) && localSuggestions[activeTab]?.includes(s)));

  const filteredSaved = (savedSuggestions || []).filter((s: any) => s.suggestion_type === activeTab && s.status !== "rejected");
  const filteredLocal = localSuggestions[activeTab] || [];
  const filtered = [...filteredSaved, ...filteredLocal];

  const handleGenerate = async () => {
    if (!activeOrgId) return;
    setIsGenerating(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-arguments`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          organization_id: activeOrgId,
          process_id: processId || null,
          draft_id: draftId || null,
          suggestion_type: activeTab,
          piece_type: pieceType || null,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Erro ao gerar sugestões");
      }

      const { suggestions } = await resp.json();

      // Persist to DB
      if (suggestions?.length && draftId && user) {
        const rows = suggestions.map((s: Suggestion) => ({
          organization_id: activeOrgId!,
          draft_id: draftId,
          process_id: processId || null,
          user_id: user.id,
          suggestion_type: activeTab,
          title: s.title,
          content: s.content,
          legal_basis: s.legal_basis || "",
          jurisprudence: s.jurisprudence || "",
          risk_level: s.risk_level || "medium",
          strength_score: s.strength_score || 50,
          category: s.category || "merito",
          sources: [],
          status: "pending",
        }));
        await supabase.from("argument_suggestions").insert(rows);
        queryClient.invalidateQueries({ queryKey: ["argument-suggestions"] });
      } else if (suggestions?.length) {
        // If no draft, keep locally
        setLocalSuggestions((prev) => ({
          ...prev,
          [activeTab]: [...(prev[activeTab] || []), ...suggestions],
        }));
      }

      toast({ title: `${suggestions?.length || 0} sugestões geradas!` });
    } catch (e: any) {
      toast({ title: "Erro ao gerar sugestões", description: e.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInsert = async (suggestion: Suggestion) => {
    onInsert(suggestion.content);
    if (suggestion.id) {
      await supabase.from("argument_suggestions").update({ status: "inserted" }).eq("id", suggestion.id);
      // Audit
      await supabase.from("audit_logs").insert({
        action: "argument_suggestion_inserted",
        user_id: user?.id || null,
        organization_id: activeOrgId,
        resource_type: "argument_suggestion",
        resource_id: suggestion.id,
        metadata: { suggestion_type: activeTab },
      });
      queryClient.invalidateQueries({ queryKey: ["argument-suggestions"] });
    }
    toast({ title: "Sugestão inserida na minuta" });
  };

  const handleReject = async (suggestion: Suggestion) => {
    if (suggestion.id) {
      await supabase.from("argument_suggestions").update({ status: "rejected" }).eq("id", suggestion.id);
      await supabase.from("audit_logs").insert({
        action: "argument_suggestion_rejected",
        user_id: user?.id || null,
        organization_id: activeOrgId,
        resource_type: "argument_suggestion",
        resource_id: suggestion.id,
        metadata: { suggestion_type: activeTab },
      });
      queryClient.invalidateQueries({ queryKey: ["argument-suggestions"] });
    }
    toast({ title: "Sugestão rejeitada" });
  };

  const strengthBar = (score: number) => {
    const color = score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-destructive";
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-16 rounded-full bg-muted">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
        </div>
        <span className="text-[10px] text-muted-foreground">{score}</span>
      </div>
    );
  };

  return (
    <div className="w-full lg:w-96 shrink-0 border-l border-border bg-card">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-primary" /> Sugestões IA
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start px-2 pt-2 h-auto flex-wrap gap-1 bg-transparent">
          {SUGGESTION_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-xs px-2 py-1 h-auto">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {SUGGESTION_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-0">
            <div className="p-2">
              <Button onClick={handleGenerate} disabled={isGenerating} size="sm" className="w-full gap-1.5 mb-2">
                {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {isGenerating ? "Gerando..." : "Gerar Sugestões"}
              </Button>
            </div>

            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-2 p-2">
                {filtered.length === 0 && !isGenerating && (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Nenhuma sugestão. Clique em "Gerar" acima.
                  </p>
                )}
                {filtered.map((s, i) => {
                  const key = s.id || `local-${i}`;
                  const isExpanded = expandedId === key;
                  return (
                    <Collapsible key={key} open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : key)}>
                      <Card className="overflow-hidden">
                        <CollapsibleTrigger asChild>
                          <CardContent className="p-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-1.5 min-w-0">
                                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />}
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-foreground line-clamp-2">{s.title}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className={`text-[9px] px-1 py-0 ${RISK_COLORS[s.risk_level] || ""}`}>
                                      {RISK_LABELS[s.risk_level] || s.risk_level}
                                    </Badge>
                                    {strengthBar(s.strength_score)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-2.5 pb-2.5 space-y-2 border-t border-border pt-2">
                            <p className="text-xs text-foreground whitespace-pre-wrap">{s.content}</p>
                            {s.legal_basis && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground">Base Legal</p>
                                <p className="text-xs text-foreground">{s.legal_basis}</p>
                              </div>
                            )}
                            {s.jurisprudence && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground">Jurisprudência</p>
                                <p className="text-xs text-foreground">{s.jurisprudence}</p>
                              </div>
                            )}
                            <div className="flex gap-1.5 pt-1">
                              {activeTab !== "counter_argument" && (
                                <Button size="sm" variant="default" className="text-xs h-7 gap-1" onClick={() => handleInsert(s)}>
                                  <Plus className="h-3 w-3" /> Inserir
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleReject(s)}>
                                Rejeitar
                              </Button>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
