import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Clock, Target, Handshake, Sparkles, Loader2, History } from "lucide-react";

type PredictionType = "time_estimation" | "success_probability" | "settlement_recommendation";

const PREDICTIONS = [
  { type: "time_estimation" as PredictionType, label: "Tempo", icon: Clock },
  { type: "success_probability" as PredictionType, label: "Êxito", icon: Target },
  { type: "settlement_recommendation" as PredictionType, label: "Acordo", icon: Handshake },
];

interface Props {
  processId: string;
  organizationId: string;
}

const ProcessPredictionsPanel = ({ processId, organizationId }: Props) => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [active, setActive] = useState<PredictionType>("time_estimation");
  const [currentResult, setCurrentResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const canGenerate = hasPermission("GENERATE_PREDICTIONS");

  // Fetch history for this process + type
  const { data: history = [] } = useQuery({
    queryKey: ["prediction-history", processId, active],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("predictions")
        .select("id, prediction_type, ai_explanation, generated_at, created_at")
        .eq("target_id", processId)
        .eq("target_type", "process")
        .eq("prediction_type", active)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!processId,
  });

  const handleGenerate = async () => {
    if (!processId || !organizationId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-predictions", {
        body: {
          process_id: processId,
          organization_id: organizationId,
          prediction_type: active,
          user_id: user?.id,
        },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setCurrentResult(data.result);
      queryClient.invalidateQueries({ queryKey: ["prediction-history", processId, active] });
      toast.success("Análise gerada e salva!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar análise.");
    } finally {
      setLoading(false);
    }
  };

  const displayResult = currentResult || (history.length > 0 ? history[0].ai_explanation : null);

  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-secondary" />
          <span className="text-overline text-muted-foreground">Previsão Processual IA</span>
        </div>
        <div className="flex items-center gap-1.5">
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <History className="h-3 w-3" />
              {history.length} análise(s)
            </button>
          )}
          <Badge variant="secondary" className="text-[9px] gap-1">
            <Sparkles className="h-2.5 w-2.5" /> Qualitativa
          </Badge>
        </div>
      </div>

      {/* Prediction type selector */}
      <div className="flex gap-1.5 mb-3">
        {PREDICTIONS.map((p) => (
          <button
            key={p.type}
            onClick={() => { setActive(p.type); setCurrentResult(null); setShowHistory(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              active === p.type
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <p.icon className="h-3.5 w-3.5" />
            {p.label}
          </button>
        ))}
      </div>

      {/* Generate button */}
      {canGenerate && (
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg gap-1.5 mb-3"
          disabled={loading}
          onClick={handleGenerate}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? "Gerando análise..." : "Gerar Nova Análise"}
        </Button>
      )}

      {/* History list */}
      {showHistory && history.length > 0 && (
        <div className="space-y-1.5 mb-3 max-h-32 overflow-y-auto">
          {history.map((h, i) => (
            <button
              key={h.id}
              onClick={() => setCurrentResult(h.ai_explanation)}
              className="flex items-center gap-2 w-full p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left"
            >
              <History className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-[11px] text-foreground truncate flex-1">
                {i === 0 ? "Mais recente" : `Análise ${history.length - i}`}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {new Date(h.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Result */}
      {displayResult ? (
        <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/30 rounded-xl p-4 max-h-64 overflow-y-auto">
          <ReactMarkdown>{displayResult}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-caption text-muted-foreground text-center py-4">
          Clique em <strong>Gerar Nova Análise</strong> para obter a previsão de {PREDICTIONS.find(p => p.type === active)?.label.toLowerCase()}.
        </p>
      )}
    </div>
  );
};

export default ProcessPredictionsPanel;
