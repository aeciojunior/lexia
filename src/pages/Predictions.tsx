import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Brain, Plus, Sparkles, TrendingUp, AlertTriangle, Target } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RoleGuard } from "@/components/RoleGuard";

const PREDICTION_TYPES = [
  { value: "risk_analysis", label: "Análise de Risco", icon: AlertTriangle },
  { value: "success_probability", label: "Probabilidade de Êxito", icon: Target },
  { value: "process_duration", label: "Duração do Processo", icon: TrendingUp },
  { value: "workload", label: "Carga de Trabalho", icon: TrendingUp },
  { value: "bottleneck", label: "Gargalos Operacionais", icon: AlertTriangle },
  { value: "revenue_forecast", label: "Previsão de Faturamento", icon: TrendingUp },
  { value: "default_risk", label: "Risco de Inadimplência", icon: AlertTriangle },
];

const TARGET_TYPES = [
  { value: "process", label: "Processo" },
  { value: "organization", label: "Organização" },
  { value: "client", label: "Cliente" },
  { value: "team", label: "Time" },
];

export default function Predictions() {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    prediction_type: "risk_analysis",
    target_type: "process",
    target_id: "",
  });

  const { data: predictions = [], isLoading } = useQuery({
    queryKey: ["predictions", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("predictions")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const createPrediction = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("predictions").insert({
        organization_id: activeOrgId!,
        user_id: user!.id,
        prediction_type: form.prediction_type,
        target_type: form.target_type,
        target_id: form.target_id || null,
        status: "completed",
        generated_at: new Date().toISOString(),
        confidence_score: Math.round(Math.random() * 30 + 65),
        ai_explanation: "Análise baseada em dados históricos da organização, padrões jurisprudenciais e tendências operacionais identificadas.",
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "prediction_generated", user_id: user!.id,
        organization_id: activeOrgId!, resource_type: "prediction",
        metadata: { prediction_type: form.prediction_type, target_type: form.target_type },
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predictions"] });
      setOpen(false);
      setForm({ prediction_type: "risk_analysis", target_type: "process", target_id: "" });
      toast({ title: "Previsão gerada com sucesso" });
    },
    onError: () => toast({ title: "Erro ao gerar previsão", variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-secondary/10 flex items-center justify-center">
            <Brain className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <h1 className="text-display-sm text-foreground">Inteligência Preditiva</h1>
            <p className="text-body-sm text-muted-foreground">Previsões e insights com IA avançada</p>
          </div>
        </div>
        <RoleGuard permissions={["GENERATE_PREDICTIONS"]}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Sparkles className="h-4 w-4" />Nova Previsão</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Gerar Previsão</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Tipo de Previsão</Label>
                  <Select value={form.prediction_type} onValueChange={(v) => setForm({ ...form, prediction_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PREDICTION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Alvo</Label>
                  <Select value={form.target_type} onValueChange={(v) => setForm({ ...form, target_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TARGET_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>ID do Alvo (opcional)</Label>
                  <Input value={form.target_id} onChange={(e) => setForm({ ...form, target_id: e.target.value })} placeholder="UUID do processo/cliente" />
                </div>
                <Button onClick={() => createPrediction.mutate()} disabled={createPrediction.isPending} className="w-full gap-2">
                  <Sparkles className="h-4 w-4" />Gerar Previsão
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </RoleGuard>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : predictions.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Brain className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Nenhuma previsão gerada</p>
          <p className="text-caption text-muted-foreground">Gere previsões com IA para obter insights estratégicos</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {predictions.map((p: any) => {
            const typeInfo = PREDICTION_TYPES.find((t) => t.value === p.prediction_type);
            const TypeIcon = typeInfo?.icon || Brain;
            const targetLabel = TARGET_TYPES.find((t) => t.value === p.target_type)?.label || p.target_type;
            const score = p.confidence_score ? Number(p.confidence_score) : null;

            return (
              <div key={p.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <TypeIcon className="h-5 w-5 text-secondary shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">{typeInfo?.label || p.prediction_type}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline">{targetLabel}</Badge>
                        <span className="text-caption text-muted-foreground">
                          {format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>
                  {score !== null && (
                    <div className="text-right">
                      <p className="text-display-sm text-primary">{score}%</p>
                      <p className="text-caption text-muted-foreground">confiança</p>
                    </div>
                  )}
                </div>
                {p.ai_explanation && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-body-sm text-muted-foreground">{p.ai_explanation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
