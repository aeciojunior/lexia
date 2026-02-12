import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, GitCommitHorizontal, Edit } from "lucide-react";

const MOVEMENT_TYPES = [
  { value: "despacho", label: "Despacho" },
  { value: "decisao", label: "Decisão" },
  { value: "sentenca", label: "Sentença" },
  { value: "peticao", label: "Petição Protocolada" },
  { value: "observacao", label: "Observação Interna" },
  { value: "other", label: "Outro" },
];

interface ProcessMovementsProps {
  processId: string;
}

const ProcessMovements = ({ processId }: ProcessMovementsProps) => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", movement_type: "despacho", movement_date: format(new Date(), "yyyy-MM-dd") });

  const resetForm = () => { setForm({ title: "", description: "", movement_type: "despacho", movement_date: format(new Date(), "yyyy-MM-dd") }); setEditId(null); };

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["process-movements", processId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("process_movements" as any)
        .select("*")
        .eq("process_id", processId)
        .order("movement_date", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!processId,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = {
        process_id: processId,
        organization_id: activeOrgId,
        user_id: user!.id,
        title: values.title,
        description: values.description || null,
        movement_type: values.movement_type,
        origin: "manual",
        movement_date: values.movement_date + "T00:00:00Z",
      };
      if (editId) {
        const { error } = await supabase.from("process_movements" as any).update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("process_movements" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-movements", processId] });
      toast.success(editId ? "Atualizada!" : "Movimentação registrada!");
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GitCommitHorizontal className="h-4 w-4 text-primary" />
          <span className="text-overline text-muted-foreground">Movimentações</span>
          <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
            {movements.length}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { resetForm(); setOpen(true); }}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {isLoading ? (
        <p className="text-caption text-muted-foreground text-center py-4">Carregando...</p>
      ) : movements.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-caption text-muted-foreground mb-2">Nenhuma movimentação registrada.</p>
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="h-3 w-3 mr-1" /> Registrar
          </Button>
        </div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {movements.map((m: any) => {
            const typeInfo = MOVEMENT_TYPES.find((t) => t.value === m.movement_type);
            return (
              <div key={m.id} className="flex items-start gap-2.5 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <GitCommitHorizontal className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-caption font-medium truncate">{m.title}</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">{typeInfo?.label || m.movement_type}</Badge>
                  </div>
                  {m.description && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{m.description}</p>}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {format(new Date(m.movement_date), "dd/MM/yy", { locale: ptBR })}
                </span>
                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => {
                  setForm({ title: m.title, description: m.description || "", movement_type: m.movement_type, movement_date: format(new Date(m.movement_date), "yyyy-MM-dd") });
                  setEditId(m.id);
                  setOpen(true);
                }}>
                  <Edit className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">{editId ? "Editar" : "Nova Movimentação"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-3">
            <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="h-9 text-sm" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" value={form.movement_date} onChange={(e) => setForm({ ...form, movement_date: e.target.value })} className="h-9 text-sm" /></div>
              <div><Label>Tipo</Label>
                <Select value={form.movement_type} onValueChange={(v) => setForm({ ...form, movement_type: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{MOVEMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="text-sm" /></div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button size="sm" type="submit" disabled={saveMutation.isPending || !form.title}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProcessMovements;
