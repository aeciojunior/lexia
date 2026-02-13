import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { FileText, Plus, Download, Clock, Sparkles, Filter, Calendar, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RoleGuard } from "@/components/RoleGuard";

const REPORT_TYPES = [
  { value: "process_status", label: "Andamento Processual" },
  { value: "risk_analysis", label: "Análise de Risco" },
  { value: "by_area", label: "Por Área Jurídica" },
  { value: "by_client", label: "Por Cliente" },
  { value: "by_lawyer", label: "Por Advogado" },
  { value: "hearings", label: "Audiências" },
  { value: "deadlines", label: "Prazos" },
  { value: "productivity", label: "Produtividade" },
  { value: "workload", label: "Carga de Trabalho" },
  { value: "financial", label: "Financeiro" },
];

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  generating: { label: "Gerando...", variant: "default" },
  completed: { label: "Concluído", variant: "outline" },
  failed: { label: "Falhou", variant: "destructive" },
};

export default function Reports() {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterType, setFilterType] = useState("all");

  const [form, setForm] = useState({
    title: "",
    report_type: "process_status",
    format: "pdf",
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const createReport = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("reports").insert({
        organization_id: activeOrgId!,
        user_id: user!.id,
        title: form.title,
        report_type: form.report_type,
        format: form.format,
        status: "completed",
        generated_at: new Date().toISOString(),
      });
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        action: "report_generated",
        user_id: user!.id,
        organization_id: activeOrgId!,
        resource_type: "report",
        metadata: { report_type: form.report_type, title: form.title },
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      setOpen(false);
      setForm({ title: "", report_type: "process_status", format: "pdf" });
      toast({ title: "Relatório gerado com sucesso" });
    },
    onError: () => toast({ title: "Erro ao gerar relatório", variant: "destructive" }),
  });

  const filtered = filterType === "all" ? reports : reports.filter((r: any) => r.report_type === filterType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-display-sm text-foreground">Relatórios</h1>
            <p className="text-body-sm text-muted-foreground">Relatórios jurídicos e administrativos</p>
          </div>
        </div>
        <RoleGuard permissions={["GENERATE_REPORTS"]}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Gerar Relatório</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Relatório</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Andamento mensal" />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.report_type} onValueChange={(v) => setForm({ ...form, report_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REPORT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Formato</Label>
                  <Select value={form.format} onValueChange={(v) => setForm({ ...form, format: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="html">HTML</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => createReport.mutate()} disabled={!form.title || createReport.isPending} className="w-full gap-2">
                  <Sparkles className="h-4 w-4" />Gerar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </RoleGuard>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {REPORT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Nenhum relatório encontrado</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((r: any) => {
            const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
            const typeLabel = REPORT_TYPES.find((t) => t.value === r.report_type)?.label || r.report_type;
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{r.title}</p>
                    <div className="flex items-center gap-2 text-caption text-muted-foreground mt-0.5">
                      <span>{typeLabel}</span>
                      <span>·</span>
                      <span className="uppercase">{r.format}</span>
                      <span>·</span>
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={st.variant}>{st.label}</Badge>
                  {r.file_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={r.file_url} target="_blank" rel="noreferrer"><Download className="h-4 w-4" /></a>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
