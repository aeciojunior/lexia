import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { FileText, Plus, Sparkles, Clock, CheckCircle, Loader2, Brain } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const REPORT_TYPES = [
  { value: "legal", label: "Jurídico" },
  { value: "operational", label: "Operacional" },
  { value: "financial", label: "Financeiro" },
  { value: "strategic", label: "Estratégico" },
];

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  generating: { label: "Gerando...", variant: "secondary" },
  completed: { label: "Concluído", variant: "default" },
  failed: { label: "Falhou", variant: "destructive" },
};

const AIReports = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", report_type: "operational" });

  const canGenerate = hasPermission("GENERATE_AI_REPORTS") || hasPermission("MANAGE_AI_REPORTS");

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["ai-reports", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_reports")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("ai_reports").insert({
        organization_id: activeOrgId!,
        title: form.title,
        report_type: form.report_type,
        status: "generating",
        created_by: user!.id,
      }).select().single();
      if (error) throw error;

      // Call edge function to generate
      const { error: fnError } = await supabase.functions.invoke("generate-ai-report", {
        body: { reportId: data.id, organizationId: activeOrgId, reportType: form.report_type, title: form.title },
      });
      if (fnError) throw fnError;

      await supabase.from("audit_logs").insert({
        action: "ai_report_generated",
        user_id: user!.id,
        organization_id: activeOrgId!,
        resource_type: "ai_report",
        resource_id: data.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-reports"] });
      setOpen(false);
      setForm({ title: "", report_type: "operational" });
      toast({ title: "Relatório sendo gerado pela IA" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const [selectedReport, setSelectedReport] = useState<any>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Relatórios IA</h1>
          <p className="text-muted-foreground">Relatórios automáticos gerados por inteligência artificial</p>
        </div>
        {canGenerate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Gerar Relatório</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Gerar Relatório com IA</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Título</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Análise Mensal de Performance" /></div>
                <div><Label>Tipo</Label>
                  <Select value={form.report_type} onValueChange={v => setForm(f => ({ ...f, report_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{REPORT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={() => generateMutation.mutate()} disabled={!form.title || generateMutation.isPending} className="w-full">
                  <Sparkles className="h-4 w-4 mr-2" />{generateMutation.isPending ? "Gerando..." : "Gerar com IA"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          {REPORT_TYPES.map(t => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
        </TabsList>
        {["all", ...REPORT_TYPES.map(t => t.value)].map(tab => (
          <TabsContent key={tab} value={tab} className="space-y-4">
            {isLoading ? <p className="text-muted-foreground">Carregando...</p> :
              (reports.filter(r => tab === "all" || r.report_type === tab).length === 0 ?
                <Card><CardContent className="py-12 text-center"><Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhum relatório encontrado</p></CardContent></Card>
              :
                reports.filter(r => tab === "all" || r.report_type === tab).map(r => (
                  <Card key={r.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setSelectedReport(r)}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-primary" />
                          <CardTitle className="text-base">{r.title}</CardTitle>
                          <Badge variant={STATUS_MAP[r.status]?.variant || "outline"}>{STATUS_MAP[r.status]?.label || r.status}</Badge>
                          <Badge variant="outline">{REPORT_TYPES.find(t => t.value === r.report_type)?.label}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                      </div>
                    </CardHeader>
                    {r.summary && <CardContent><p className="text-sm text-muted-foreground line-clamp-2">{r.summary}</p></CardContent>}
                  </Card>
                ))
              )
            }
          </TabsContent>
        ))}
      </Tabs>

      {selectedReport && (
        <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{selectedReport.title}</DialogTitle></DialogHeader>
            <div className="flex gap-2 mb-4">
              <Badge variant={STATUS_MAP[selectedReport.status]?.variant}>{STATUS_MAP[selectedReport.status]?.label}</Badge>
              <Badge variant="outline">{REPORT_TYPES.find(t => t.value === selectedReport.report_type)?.label}</Badge>
            </div>
            {selectedReport.status === "generating" ? (
              <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Gerando relatório...</div>
            ) : selectedReport.content ? (
              <div className="prose prose-invert max-w-none text-sm whitespace-pre-wrap">{selectedReport.content}</div>
            ) : (
              <p className="text-muted-foreground">Sem conteúdo disponível</p>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default AIReports;
