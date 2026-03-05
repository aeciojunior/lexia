import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Clock, Target, Handshake, Sparkles, Loader2, Scale, AlertTriangle, History } from "lucide-react";

type PredictionType = "time_estimation" | "success_probability" | "settlement_recommendation";

const TAB_CONFIG: Record<PredictionType, { label: string; icon: typeof Clock; description: string }> = {
  time_estimation: {
    label: "Tempo de Tramitação",
    icon: Clock,
    description: "Estimativa qualitativa do tempo de tramitação por fase",
  },
  success_probability: {
    label: "Probabilidade de Êxito",
    icon: Target,
    description: "Avaliação qualitativa da probabilidade de êxito",
  },
  settlement_recommendation: {
    label: "Sugestão de Acordo",
    icon: Handshake,
    description: "Recomendação qualitativa sobre viabilidade de acordo",
  },
};

const ProcessPredictions = () => {
  const { activeOrgId } = useOrganization();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [selectedProcess, setSelectedProcess] = useState<string>("");
  const [activeTab, setActiveTab] = useState<PredictionType>("time_estimation");
  const [currentResult, setCurrentResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canGenerate = hasPermission("GENERATE_PREDICTIONS");

  const { data: processes } = useQuery({
    queryKey: ["processes-list", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processes")
        .select("id, title, number, status, type, classe")
        .eq("organization_id", activeOrgId!)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  // Fetch prediction history for selected process + tab
  const { data: history = [] } = useQuery({
    queryKey: ["prediction-history-page", selectedProcess, activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("predictions")
        .select("id, prediction_type, ai_explanation, generated_at, created_at, user_id")
        .eq("target_id", selectedProcess)
        .eq("target_type", "process")
        .eq("prediction_type", activeTab)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProcess,
  });

  const handleGenerate = async () => {
    if (!selectedProcess || !activeOrgId) {
      toast.error("Selecione um processo.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-predictions", {
        body: {
          process_id: selectedProcess,
          organization_id: activeOrgId,
          prediction_type: activeTab,
          user_id: user?.id,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setCurrentResult(data.result);
      queryClient.invalidateQueries({ queryKey: ["prediction-history-page", selectedProcess, activeTab] });
      toast.success("Análise gerada e salva!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao gerar análise.");
    } finally {
      setLoading(false);
    }
  };

  const selectedProc = processes?.find((p) => p.id === selectedProcess);
  const displayResult = currentResult || (history.length > 0 ? history[0].ai_explanation : null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Scale className="h-7 w-7 text-primary" />
            Previsão Processual
          </h1>
          <p className="text-muted-foreground mt-1">
            Estimativas qualitativas de tempo, êxito e acordo com IA
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Sparkles className="h-3 w-3" /> IA Qualitativa
        </Badge>
      </div>

      {/* Disclaimer */}
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            As análises são <strong>qualitativas e não vinculantes</strong>. A IA utiliza termos como
            curto/médio/longo prazo e alta/moderada/baixa probabilidade — nunca datas exatas, percentuais ou valores monetários.
          </p>
        </CardContent>
      </Card>

      {/* Process selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Selecionar Processo</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedProcess} onValueChange={(v) => { setSelectedProcess(v); setCurrentResult(null); }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Escolha um processo para análise..." />
            </SelectTrigger>
            <SelectContent>
              {processes?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="font-medium">{p.number || "Sem número"}</span>
                  <span className="text-muted-foreground ml-2">— {p.title}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProc && (
            <div className="flex gap-2 mt-3">
              <Badge variant="outline">{selectedProc.status}</Badge>
              {selectedProc.type && <Badge variant="secondary">{selectedProc.type}</Badge>}
              {selectedProc.classe && <Badge variant="outline">{selectedProc.classe}</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as PredictionType); setCurrentResult(null); }}>
        <TabsList className="grid w-full grid-cols-3">
          {(Object.entries(TAB_CONFIG) as [PredictionType, typeof TAB_CONFIG[PredictionType]][]).map(
            ([key, cfg]) => (
              <TabsTrigger key={key} value={key} className="gap-2">
                <cfg.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{cfg.label}</span>
              </TabsTrigger>
            )
          )}
        </TabsList>

        {(Object.entries(TAB_CONFIG) as [PredictionType, typeof TAB_CONFIG[PredictionType]][]).map(
          ([key, cfg]) => (
            <TabsContent key={key} value={key} className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <cfg.icon className="h-5 w-5 text-primary" />
                      {cfg.label}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{cfg.description}</p>
                  </div>
                  {canGenerate && (
                    <Button onClick={handleGenerate} disabled={loading || !selectedProcess} className="gap-2">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Gerar Análise
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {activeTab === key && displayResult ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{displayResult}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <cfg.icon className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>Selecione um processo e clique em <strong>Gerar Análise</strong> para obter a previsão.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* History section */}
              {activeTab === key && history.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <History className="h-4 w-4 text-muted-foreground" />
                      Histórico de Análises ({history.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {history.map((h, i) => (
                      <button
                        key={h.id}
                        onClick={() => setCurrentResult(h.ai_explanation)}
                        className="flex items-center gap-3 w-full p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                          <cfg.icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {i === 0 ? "Análise mais recente" : `Análise ${history.length - i}`}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {h.ai_explanation?.slice(0, 80)}...
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(h.created_at).toLocaleDateString("pt-BR", {
                            day: "2-digit", month: "short", year: "2-digit",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )
        )}
      </Tabs>
    </div>
  );
};

export default ProcessPredictions;
