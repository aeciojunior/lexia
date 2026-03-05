import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LexCard } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Brain, Shield, RefreshCw, BarChart3, AlertTriangle, FileText, Loader2, History, ChevronDown, ChevronUp,
} from "lucide-react";

type AnalysisType = "full_analysis" | "clause_analysis" | "renegotiation" | "benchmarking" | "abusive_detection" | "draft_contract";

interface Props {
  contract: any;
  contracts: any[];
}

const TAB_CONFIG: { type: AnalysisType; label: string; icon: any; description: string; permission: string }[] = [
  { type: "full_analysis", label: "Análise Completa", icon: Brain, description: "Resumo executivo, riscos, obrigações, prazos, impacto legislativo e recomendações estratégicas.", permission: "ANALYZE_CONTRACTS" },
  { type: "clause_analysis", label: "Cláusulas", icon: Shield, description: "Classifica cada cláusula como Padrão, Aceitável, Divergente, Crítica ou Proibida.", permission: "ANALYZE_CONTRACTS" },
  { type: "renegotiation", label: "Renegociação", icon: RefreshCw, description: "Identifica gatilhos e sugere tipos de renegociação com justificativas e cenários.", permission: "ANALYZE_CONTRACTS" },
  { type: "benchmarking", label: "Benchmarking", icon: BarChart3, description: "Compara cláusulas e estrutura com padrões do setor econômico.", permission: "ANALYZE_CONTRACTS" },
  { type: "abusive_detection", label: "Abusivas", icon: AlertTriangle, description: "Detecta cláusulas abusivas ou ilegais com base no CDC, LGPD, CLT e Código Civil.", permission: "ANALYZE_CONTRACTS" },
  { type: "draft_contract", label: "Redação", icon: FileText, description: "Gera um contrato completo com base em parâmetros e contexto fornecidos.", permission: "DRAFT_CONTRACTS" },
];

export const ContractIntelligencePanel = ({ contract, contracts }: Props) => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState<AnalysisType>("full_analysis");
  const [results, setResults] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [extraContext, setExtraContext] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  // Draft form state
  const [draftForm, setDraftForm] = useState({
    parties: "", object: "", sector: "tecnologia", contractType: "service",
  });

  const { data: history = [] } = useQuery({
    queryKey: ["contract-analysis-history", contract?.id, activeTab],
    queryFn: async () => {
      if (!contract?.id) return [];
      const { data } = await supabase
        .from("predictions")
        .select("*")
        .eq("target_id", contract.id)
        .eq("target_type" as any, "contract")
        .eq("prediction_type", activeTab)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!contract?.id && showHistory,
  });

  const runAnalysis = async (type: AnalysisType) => {
    if (!activeOrgId) return;
    setLoading(prev => ({ ...prev, [type]: true }));

    try {
      let context = extraContext;
      if (type === "draft_contract") {
        context = `Partes: ${draftForm.parties}\nObjeto: ${draftForm.object}\nSetor: ${draftForm.sector}\nTipo: ${draftForm.contractType}\n${extraContext}`;
      }

      const { data, error } = await supabase.functions.invoke("analyze-contract", {
        body: {
          contract_id: contract?.id || null,
          organization_id: activeOrgId,
          analysis_type: type,
          extra_context: context || undefined,
          user_id: user?.id,
        },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.error.includes("Limite")) toast.error(data.error);
        else if (data.error.includes("Créditos")) toast.error(data.error);
        else throw new Error(data.error);
        return;
      }

      setResults(prev => ({ ...prev, [type]: data.result }));
      toast.success("Análise concluída!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar análise");
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  if (!contract) {
    return (
      <LexCard className="border-dashed">
        <div className="p-8 text-center">
          <Brain className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Selecione um contrato na lista para acessar a inteligência contratual.</p>
        </div>
      </LexCard>
    );
  }

  return (
    <div className="space-y-4">
      <LexCard variant="ai">
        <div className="p-4 flex items-center gap-3">
          <Brain className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold text-sm">Inteligência Contratual — {contract.title}</h3>
            <p className="text-xs text-muted-foreground">RF-073 • Análise, risco, renegociação, benchmarking, cláusulas abusivas e redação automática</p>
          </div>
        </div>
      </LexCard>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as AnalysisType)}>
        <TabsList className="flex-wrap h-auto gap-1">
          {TAB_CONFIG.map(tab => (
            <TabsTrigger key={tab.type} value={tab.type} disabled={!hasPermission(tab.permission as any)} className="text-xs gap-1">
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_CONFIG.map(tab => (
          <TabsContent key={tab.type} value={tab.type} className="space-y-4 mt-4">
            <LexCard>
              <div className="p-4 space-y-3">
                <p className="text-sm text-muted-foreground">{tab.description}</p>

                {tab.type === "draft_contract" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Partes</label>
                      <Textarea placeholder="Descreva as partes do contrato..." value={draftForm.parties} onChange={e => setDraftForm(f => ({ ...f, parties: e.target.value }))} rows={2} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Objeto</label>
                      <Textarea placeholder="Descreva o objeto do contrato..." value={draftForm.object} onChange={e => setDraftForm(f => ({ ...f, object: e.target.value }))} rows={2} />
                    </div>
                    <Select value={draftForm.sector} onValueChange={v => setDraftForm(f => ({ ...f, sector: v }))}>
                      <SelectTrigger><SelectValue placeholder="Setor" /></SelectTrigger>
                      <SelectContent>
                        {["tecnologia", "energia", "telecomunicações", "saúde", "financeiro", "varejo", "logística", "indústria", "agronegócio", "transporte", "setor público"].map(s => (
                          <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={draftForm.contractType} onValueChange={v => setDraftForm(f => ({ ...f, contractType: v }))}>
                      <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        {[
                          { k: "service", l: "Prestação de Serviços" }, { k: "supply", l: "Fornecimento" },
                          { k: "nda", l: "Confidencialidade (NDA)" }, { k: "partnership", l: "Parceria Comercial" },
                          { k: "regulated", l: "Contrato Regulado" }, { k: "financial", l: "Financeiro" },
                          { k: "tech", l: "Tecnologia (SaaS/DPA)" }, { k: "labor", l: "Trabalhista" },
                          { k: "international", l: "Internacional" },
                        ].map(t => <SelectItem key={t.k} value={t.k}>{t.l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Textarea
                  placeholder="Contexto adicional (opcional)..."
                  value={extraContext}
                  onChange={e => setExtraContext(e.target.value)}
                  rows={2}
                  className="text-sm"
                />

                <div className="flex gap-2 items-center">
                  <Button onClick={() => runAnalysis(tab.type)} disabled={loading[tab.type]} size="sm">
                    {loading[tab.type] ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analisando...</> : <>Gerar Análise</>}
                  </Button>
                  {contract?.id && (
                    <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)} className="text-xs gap-1">
                      <History className="h-3.5 w-3.5" />
                      Histórico
                      {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
              </div>
            </LexCard>

            {/* Result */}
            {results[tab.type] && (
              <LexCard variant="glow">
                <ScrollArea className="max-h-[500px]">
                  <div className="p-5 prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{results[tab.type]}</ReactMarkdown>
                  </div>
                </ScrollArea>
              </LexCard>
            )}

            {/* History */}
            {showHistory && history.length > 0 && (
              <LexCard>
                <div className="p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <History className="h-3.5 w-3.5" /> Análises anteriores ({history.length})
                  </h4>
                  {history.map((h: any) => (
                    <div
                      key={h.id}
                      className="p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => setResults(prev => ({ ...prev, [tab.type]: h.ai_explanation }))}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(h.created_at), "dd/MM/yyyy HH:mm")}
                        </p>
                        <LexBadge variant="outline" className="text-xs">{h.prediction_type}</LexBadge>
                      </div>
                      <p className="text-xs mt-1 line-clamp-2">{h.ai_explanation?.slice(0, 150)}...</p>
                    </div>
                  ))}
                </div>
              </LexCard>
            )}
            {showHistory && history.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">Nenhuma análise anterior encontrada.</p>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
