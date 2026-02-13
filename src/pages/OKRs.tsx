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
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Target, Plus, TrendingUp, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const OKRs = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expandedOkrs, setExpandedOkrs] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ title: "", description: "", period_start: new Date().toISOString().split("T")[0], period_end: "", owner_id: "" });

  const canManage = hasPermission("MANAGE_OKRS");

  const { data: okrs = [], isLoading } = useQuery({
    queryKey: ["okrs", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("okrs")
        .select("*, okr_key_results(*)")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("okrs").insert({
        organization_id: activeOrgId!,
        title: form.title,
        description: form.description,
        period_start: form.period_start,
        period_end: form.period_end || new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
        owner_id: user!.id,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "okr_created",
        user_id: user!.id,
        organization_id: activeOrgId!,
        resource_type: "okr",
        metadata: { title: form.title },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["okrs"] });
      setOpen(false);
      setForm({ title: "", description: "", period_start: new Date().toISOString().split("T")[0], period_end: "", owner_id: "" });
      toast({ title: "OKR criado com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const toggleExpand = (id: string) => {
    setExpandedOkrs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const statusColor = (s: string) => {
    if (s === "completed") return "default";
    if (s === "at_risk") return "destructive";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">OKRs & KPIs</h1>
          <p className="text-muted-foreground">Indicadores estratégicos e resultados-chave</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo OKR</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar OKR</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Objetivo</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Aumentar eficiência processual em 30%" /></div>
                <div><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-2"><div><Label>Início</Label><Input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} /></div><div><Label>Fim</Label><Input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} /></div></div>
                <Button onClick={() => createMutation.mutate()} disabled={!form.title || createMutation.isPending} className="w-full">
                  {createMutation.isPending ? "Salvando..." : "Criar OKR"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? <p className="text-muted-foreground">Carregando...</p> :
        okrs.length === 0 ? (
          <Card><CardContent className="py-12 text-center"><Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhum OKR cadastrado</p></CardContent></Card>
        ) : (
          <div className="space-y-4">
            {okrs.map(okr => {
              const krs = okr.okr_key_results || [];
              const isExpanded = expandedOkrs.has(okr.id);
              return (
                <Card key={okr.id}>
                  <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleExpand(okr.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <Target className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">{okr.title}</CardTitle>
                        <Badge variant={statusColor(okr.status)}>{okr.status}</Badge>
                        <Badge variant="outline">{okr.period_start} → {okr.period_end}</Badge>
                      </div>
                      <span className="text-sm font-bold text-primary">{Number(okr.progress).toFixed(0)}%</span>
                    </div>
                    <Progress value={Number(okr.progress)} className="mt-2 h-2" />
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="pt-0">
                      {okr.description && <p className="text-sm text-muted-foreground mb-3">{okr.description}</p>}
                      {krs.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Resultados-chave</p>
                          {krs.map((kr: any) => (
                            <div key={kr.id} className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
                              <TrendingUp className="h-4 w-4 text-secondary" />
                              <div className="flex-1">
                                <p className="text-sm font-medium">{kr.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Progress value={(kr.current_value / (kr.target_value || 1)) * 100} className="h-1.5 flex-1" />
                                  <span className="text-xs text-muted-foreground">{kr.current_value}/{kr.target_value} {kr.unit}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Nenhum resultado-chave definido</p>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )
      }
    </div>
  );
};

export default OKRs;
