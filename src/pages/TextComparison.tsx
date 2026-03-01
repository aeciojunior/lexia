import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import DiffView from "@/components/drafts/DiffView";
import { toast } from "@/hooks/use-toast";
import { Loader2, ArrowLeftRight, AlertTriangle, CheckCircle, Info, Trash2, Clock, FileDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from "react-markdown";

interface AiAnalysis {
  resumo?: string;
  alteracoes_criticas?: { trecho: string; tipo: string; descricao: string; risco: string }[];
  alteracoes_semanticas?: { original: string; modificado: string; impacto: string }[];
  alteracoes_juridicas?: { aspecto: string; antes: string; depois: string; impacto_juridico: string; risco: string }[];
  sugestoes_harmonizacao?: string[];
  risco_geral?: string;
}

interface ComparisonRecord {
  id: string;
  comparison_type: string;
  text_a_label: string;
  text_b_label: string;
  text_a: string;
  text_b: string;
  ai_analysis: AiAnalysis;
  risk_level: string | null;
  created_at: string;
}

const RISK_COLORS: Record<string, string> = {
  alto: "bg-destructive text-destructive-foreground",
  médio: "bg-accent text-accent-foreground",
  baixo: "bg-secondary text-secondary-foreground",
};

const RISK_ICONS: Record<string, typeof AlertTriangle> = {
  alto: AlertTriangle,
  médio: Info,
  baixo: CheckCircle,
};

export default function TextComparison() {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();

  const [textA, setTextA] = useState("");
  const [textB, setTextB] = useState("");
  const [labelA, setLabelA] = useState("Texto A");
  const [labelB, setLabelB] = useState("Texto B");
  const [comparisonType, setComparisonType] = useState("general");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ analysis: AiAnalysis } | null>(null);
  const [activeTab, setActiveTab] = useState("diff");

  // History
  const [history, setHistory] = useState<ComparisonRecord[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handleCompare = async () => {
    if (!textA.trim() || !textB.trim()) {
      toast({ title: "Preencha ambos os textos", variant: "destructive" });
      return;
    }
    if (!activeOrgId) {
      toast({ title: "Selecione uma organização", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("compare-texts", {
        body: {
          textA,
          textB,
          comparisonType,
          labelA,
          labelB,
          organizationId: activeOrgId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult({ analysis: data.analysis });
      setActiveTab("analysis");
      toast({ title: "Comparação concluída!" });
      // Refresh history if loaded
      if (historyLoaded) loadHistory();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro na comparação", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!activeOrgId) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("text_comparisons")
        .select("*")
        .eq("organization_id", activeOrgId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setHistory((data as any[]) || []);
      setHistoryLoaded(true);
    } catch (e: any) {
      toast({ title: "Erro ao carregar histórico", description: e.message, variant: "destructive" });
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadFromHistory = (record: ComparisonRecord) => {
    setTextA(record.text_a);
    setTextB(record.text_b);
    setLabelA(record.text_a_label);
    setLabelB(record.text_b_label);
    setComparisonType(record.comparison_type);
    setResult({ analysis: record.ai_analysis });
    setActiveTab("analysis");
  };

  const deleteComparison = async (id: string) => {
    const { error } = await supabase.from("text_comparisons").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      setHistory((prev) => prev.filter((h) => h.id !== id));
    }
  };

  const analysis = result?.analysis;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Comparação de Textos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Compare textos jurídicos com análise literal, semântica e de risco.
        </p>
      </div>

      {/* Config row */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Tipo de comparação</label>
          <Select value={comparisonType} onValueChange={setComparisonType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">Geral</SelectItem>
              <SelectItem value="contract">Contrato (cláusula a cláusula)</SelectItem>
              <SelectItem value="legal_piece">Peça Jurídica</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[120px]">
          <label className="text-xs font-medium text-muted-foreground">Rótulo A</label>
          <Input value={labelA} onChange={(e) => setLabelA(e.target.value)} />
        </div>
        <div className="space-y-1 flex-1 min-w-[120px]">
          <label className="text-xs font-medium text-muted-foreground">Rótulo B</label>
          <Input value={labelB} onChange={(e) => setLabelB(e.target.value)} />
        </div>
      </div>

      {/* Input areas side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold text-foreground">{labelA}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <Textarea
              value={textA}
              onChange={(e) => setTextA(e.target.value)}
              placeholder="Cole ou digite o primeiro texto aqui..."
              className="min-h-[220px] font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">{textA.length.toLocaleString()} caracteres</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold text-foreground">{labelB}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <Textarea
              value={textB}
              onChange={(e) => setTextB(e.target.value)}
              placeholder="Cole ou digite o segundo texto aqui..."
              className="min-h-[220px] font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">{textB.length.toLocaleString()} caracteres</p>
          </CardContent>
        </Card>
      </div>

      {/* Compare button */}
      <div className="flex justify-center">
        <Button onClick={handleCompare} disabled={loading || !textA.trim() || !textB.trim()} size="lg" className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
          {loading ? "Analisando..." : "Comparar Textos"}
        </Button>
      </div>

      {/* Results */}
      {(analysis || textA || textB) && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="diff">Diff Literal</TabsTrigger>
            <TabsTrigger value="analysis" disabled={!analysis}>Análise IA</TabsTrigger>
            <TabsTrigger value="risks" disabled={!analysis}>Riscos</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          {/* Diff tab */}
          <TabsContent value="diff">
            {textA && textB ? (
              <Card className="border-border">
                <CardContent className="p-4">
                  <DiffView original={textA} revised={textB} />
                </CardContent>
              </Card>
            ) : (
              <p className="text-muted-foreground text-sm">Preencha ambos os textos para visualizar o diff.</p>
            )}
          </TabsContent>

          {/* AI Analysis tab */}
          <TabsContent value="analysis">
            {analysis && (
              <div className="space-y-4">
                {/* Resumo */}
                <Card className="border-border">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      Resumo Geral
                      {analysis.risco_geral && analysis.risco_geral !== "nenhum" && (
                        <Badge className={RISK_COLORS[analysis.risco_geral] || ""}>
                          Risco {analysis.risco_geral}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0 prose prose-sm max-w-none text-foreground">
                    <ReactMarkdown>{analysis.resumo || "Sem resumo disponível."}</ReactMarkdown>
                  </CardContent>
                </Card>

                {/* Alterações críticas */}
                {analysis.alteracoes_criticas && analysis.alteracoes_criticas.length > 0 && (
                  <Card className="border-border">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">Alterações Críticas ({analysis.alteracoes_criticas.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 space-y-3">
                      {analysis.alteracoes_criticas.map((c, i) => {
                        const RiskIcon = RISK_ICONS[c.risco] || Info;
                        return (
                          <div key={i} className="p-3 rounded-lg bg-muted/50 border border-border space-y-1">
                            <div className="flex items-center gap-2">
                              <RiskIcon className="h-4 w-4 shrink-0" />
                              <Badge variant="outline" className="text-xs">{c.tipo}</Badge>
                              <Badge className={`text-xs ${RISK_COLORS[c.risco] || ""}`}>{c.risco}</Badge>
                            </div>
                            <p className="text-sm text-foreground">{c.descricao}</p>
                            <p className="text-xs text-muted-foreground font-mono">"{c.trecho}"</p>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {/* Alterações semânticas */}
                {analysis.alteracoes_semanticas && analysis.alteracoes_semanticas.length > 0 && (
                  <Card className="border-border">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">Alterações Semânticas ({analysis.alteracoes_semanticas.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 space-y-3">
                      {analysis.alteracoes_semanticas.map((s, i) => (
                        <div key={i} className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="font-semibold text-destructive">Original:</span>
                              <p className="text-foreground mt-1">{s.original}</p>
                            </div>
                            <div>
                              <span className="font-semibold text-primary">Modificado:</span>
                              <p className="text-foreground mt-1">{s.modificado}</p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">Impacto: {s.impacto}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Sugestões */}
                {analysis.sugestoes_harmonizacao && analysis.sugestoes_harmonizacao.length > 0 && (
                  <Card className="border-border">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">Sugestões de Harmonização</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                      <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                        {analysis.sugestoes_harmonizacao.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* Risks tab */}
          <TabsContent value="risks">
            {analysis?.alteracoes_juridicas && analysis.alteracoes_juridicas.length > 0 ? (
              <div className="space-y-3">
                {analysis.alteracoes_juridicas.map((j, i) => {
                  const RiskIcon = RISK_ICONS[j.risco] || Info;
                  return (
                    <Card key={i} className="border-border">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <RiskIcon className="h-4 w-4 shrink-0" />
                          <span className="font-semibold text-sm text-foreground">{j.aspecto}</span>
                          <Badge className={`ml-auto text-xs ${RISK_COLORS[j.risco] || ""}`}>{j.risco}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="p-2 rounded bg-destructive/10 border border-destructive/20">
                            <span className="font-medium text-destructive">Antes:</span>
                            <p className="text-foreground mt-1">{j.antes}</p>
                          </div>
                          <div className="p-2 rounded bg-primary/10 border border-primary/20">
                            <span className="font-medium text-primary">Depois:</span>
                            <p className="text-foreground mt-1">{j.depois}</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{j.impacto_juridico}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-border">
                <CardContent className="p-6 text-center">
                  <CheckCircle className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma alteração jurídica de risco identificada.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* History tab */}
          <TabsContent value="history">
            {!historyLoaded ? (
              <div className="text-center py-6">
                <Button variant="outline" onClick={loadHistory} disabled={loadingHistory}>
                  {loadingHistory ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
                  Carregar histórico
                </Button>
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma comparação anterior encontrada.</p>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <Card key={h.id} className="border-border">
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <button onClick={() => loadFromHistory(h)} className="flex-1 text-left hover:opacity-80 transition-opacity">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{h.text_a_label} × {h.text_b_label}</span>
                          <Badge variant="outline" className="text-xs">{h.comparison_type}</Badge>
                          {h.risk_level && (
                            <Badge className={`text-xs ${RISK_COLORS[h.risk_level] || ""}`}>{h.risk_level}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(h.created_at), "dd MMM yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </button>
                      <Button variant="ghost" size="icon" onClick={() => deleteComparison(h.id)} className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
