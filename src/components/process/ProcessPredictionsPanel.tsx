import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Clock, Target, Handshake, Sparkles, Loader2 } from "lucide-react";

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
  const [active, setActive] = useState<PredictionType>("time_estimation");
  const [results, setResults] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const canGenerate = hasPermission("GENERATE_PREDICTIONS");

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
      setResults((prev) => ({ ...prev, [active]: data.result }));
      toast.success("Análise gerada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar análise.");
    } finally {
      setLoading(false);
    }
  };

  const currentResult = results[active];

  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-secondary" />
          <span className="text-overline text-muted-foreground">Previsão Processual IA</span>
        </div>
        <Badge variant="secondary" className="text-[9px] gap-1">
          <Sparkles className="h-2.5 w-2.5" /> Qualitativa
        </Badge>
      </div>

      {/* Prediction type selector */}
      <div className="flex gap-1.5 mb-3">
        {PREDICTIONS.map((p) => (
          <button
            key={p.type}
            onClick={() => setActive(p.type)}
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
          {loading ? "Gerando análise..." : "Gerar Análise"}
        </Button>
      )}

      {/* Result */}
      {currentResult ? (
        <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/30 rounded-xl p-4 max-h-64 overflow-y-auto">
          <ReactMarkdown>{currentResult}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-caption text-muted-foreground text-center py-4">
          Clique em <strong>Gerar Análise</strong> para obter a previsão de {PREDICTIONS.find(p => p.type === active)?.label.toLowerCase()}.
        </p>
      )}
    </div>
  );
};

export default ProcessPredictionsPanel;
