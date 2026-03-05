import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Clock, Target, Handshake, Sparkles, Loader2, Scale, AlertTriangle } from "lucide-react";

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
  const [selectedProcess, setSelectedProcess] = useState<string>("");
  const [activeTab, setActiveTab] = useState<PredictionType>("time_estimation");
  const [results, setResults] = useState<Record<string, string>>({});
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

      setResults((prev) => ({ ...prev, [`${selectedProcess}_${activeTab}`]: data.result }));
      toast.success("Análise gerada com sucesso!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao gerar análise.");
    } finally {
      setLoading(false);
    }
  };

  const currentResult = results[`${selectedProcess}_${activeTab}`];
  const selectedProc = processes?.find((p) => p.id === selectedProcess);

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
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            As análises são <strong>qualitativas e não vinculantes</strong>. A IA utiliza termos como 
            curto/médio/longo prazo e alta/moderada/baixa probabilidade — nunca datas exatas, percentuais ou valores monetários.
            As limitações são indicadas quando os dados são insuficientes.
          </p>
        </CardContent>
      </Card>

      {/* Process selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Selecionar Processo</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedProcess} onValueChange={setSelectedProcess}>
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
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PredictionType)}>
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
                  {results[`${selectedProcess}_${key}`] ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{results[`${selectedProcess}_${key}`]}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <cfg.icon className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>Selecione um processo e clique em <strong>Gerar Análise</strong> para obter a previsão.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )
        )}
      </Tabs>
    </div>
  );
};

export default ProcessPredictions;
