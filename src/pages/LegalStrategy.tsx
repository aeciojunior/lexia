import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { RoleGuard } from "@/components/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Target, Sparkles, Loader2, Scale, Shield, FileText, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function LegalStrategy() {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const [selectedProcess, setSelectedProcess] = useState("");
  const [strategy, setStrategy] = useState<string | null>(null);

  const { data: processes = [] } = useQuery({
    queryKey: ["strategy-processes", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("processes").select("id, title, number, type").eq("archived", false).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const generateStrategy = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-legal-strategy", {
        body: { process_id: selectedProcess, organization_id: activeOrgId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.strategy;
    },
    onSuccess: async (data) => {
      setStrategy(data);
      await supabase.from("audit_logs").insert({
        action: "legal_strategy_generated", user_id: user!.id,
        organization_id: activeOrgId!, resource_type: "legal_strategy",
        metadata: { process_id: selectedProcess },
      } as any);
      toast({ title: "Estratégia gerada com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro ao gerar estratégia", description: e.message, variant: "destructive" }),
  });

  const selectedProcessData = processes.find((p: any) => p.id === selectedProcess);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Motor de Estratégia Jurídica</h1>
          <p className="text-sm text-muted-foreground">RF-069 — Gere estratégias personalizadas com IA</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Select value={selectedProcess} onValueChange={setSelectedProcess}>
                <SelectTrigger><SelectValue placeholder="Selecione um processo" /></SelectTrigger>
                <SelectContent>
                  {processes.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.number ? `${p.number} — ` : ""}{p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <RoleGuard permissions={["GENERATE_LEGAL_STRATEGY"]}>
              <Button onClick={() => generateStrategy.mutate()} disabled={!selectedProcess || generateStrategy.isPending} className="gap-2">
                {generateStrategy.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar Estratégia
              </Button>
            </RoleGuard>
          </div>

          {selectedProcessData && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Scale className="h-4 w-4" />
              <span>{selectedProcessData.title}</span>
              <Badge variant="outline">{selectedProcessData.type}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {strategy && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              Estratégia Gerada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{strategy}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {!strategy && !generateStrategy.isPending && (
        <div className="text-center py-16 space-y-4">
          <div className="flex justify-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center"><Scale className="h-6 w-6 text-muted-foreground" /></div>
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center"><Shield className="h-6 w-6 text-muted-foreground" /></div>
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center"><FileText className="h-6 w-6 text-muted-foreground" /></div>
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center"><AlertTriangle className="h-6 w-6 text-muted-foreground" /></div>
          </div>
          <p className="text-muted-foreground">Selecione um processo e gere uma estratégia jurídica personalizada</p>
          <p className="text-xs text-muted-foreground">A IA analisará fatos, provas, jurisprudência e riscos para sugerir caminhos estratégicos</p>
        </div>
      )}
    </div>
  );
}
