import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { ProcessDetailsDialog } from "@/components/process/ProcessDetailsDialog";
import { LexPageHeader } from "@/components/lexia/LexPageHeader";
import { ProcessKanbanBoard } from "@/components/process/ProcessKanbanBoard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  PROCESS_RISK_OPTIONS,
  PROCESS_TYPE_OPTIONS,
  columnIdToProcessPatch,
  type KanbanColumnMode,
} from "@/lib/processConstants";
import type { DeadlineStats, KanbanProcess, OrgMemberOption } from "@/components/process/processKanbanTypes";
import { Columns3, List, Search } from "lucide-react";
import { toast } from "sonner";

const ProcessKanban = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission, isIntern, isClient } = usePermissions();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<KanbanColumnMode>("fase");
  const [search, setSearch] = useState("");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [localProcesses, setLocalProcesses] = useState<KanbanProcess[] | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<any>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const canManage = hasPermission("MANAGE_PROCESSES") && !isIntern && !isClient;

  const { data: orgMembers = [] } = useQuery({
    queryKey: ["org-members-kanban", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_organizations" as any)
        .select("user_id, profiles:user_id(full_name)")
        .eq("organization_id", activeOrgId!)
        .eq("status", "active");
      if (error) throw error;
      return ((data as any[]) || []).map((m) => ({
        user_id: m.user_id,
        full_name: m.profiles?.full_name || "Usuário",
      })) as OrgMemberOption[];
    },
    enabled: !!activeOrgId,
  });

  const { data: processes = [], isLoading } = useQuery({
    queryKey: ["process-kanban", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processes")
        .select("id, number, title, client_name, type, status, fase, risk_level, responsible_id, kanban_position, created_at")
        .eq("organization_id", activeOrgId!)
        .eq("archived", false)
        .order("kanban_position", { ascending: true });
      if (error) throw error;
      return (data || []) as KanbanProcess[];
    },
    enabled: !!activeOrgId,
  });

  const { data: deadlineMap = {} } = useQuery({
    queryKey: ["process-kanban-deadlines", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deadlines")
        .select("process_id, due_date, status")
        .eq("organization_id", activeOrgId!)
        .eq("status", "pending")
        .not("process_id", "is", null);
      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const map: Record<string, DeadlineStats> = {};

      for (const row of data || []) {
        if (!row.process_id) continue;
        if (!map[row.process_id]) map[row.process_id] = { pending: 0, overdue: 0 };
        map[row.process_id].pending += 1;
        const due = new Date(`${row.due_date}T23:59:59`);
        if (due < today) map[row.process_id].overdue += 1;
      }
      return map;
    },
    enabled: !!activeOrgId,
  });

  const boardProcesses = localProcesses ?? processes;

  const filteredProcesses = useMemo(() => {
    return boardProcesses.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        const match =
          p.title.toLowerCase().includes(q) ||
          p.number.toLowerCase().includes(q) ||
          p.client_name.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (responsibleFilter !== "all" && p.responsible_id !== responsibleFilter) return false;
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      if (riskFilter !== "all" && p.risk_level !== riskFilter) return false;
      return true;
    });
  }, [boardProcesses, search, responsibleFilter, typeFilter, riskFilter]);

  const getMemberName = (id: string) => orgMembers.find((m) => m.user_id === id)?.full_name || "—";

  const openProcess = async (process: KanbanProcess) => {
    const { data, error } = await supabase.from("processes").select("*").eq("id", process.id).single();
    if (error) {
      toast.error("Erro ao carregar processo");
      return;
    }
    setSelectedProcess(data);
    setViewOpen(true);
  };

  const handlePersistMove = async ({
    processId,
    fromColumn,
    toColumn,
    mode: columnMode,
    orderedIds,
  }: {
    processId: string;
    fromColumn: string;
    toColumn: string;
    mode: KanbanColumnMode;
    orderedIds: string[];
  }) => {
    if (!user || !activeOrgId) return;

    const patch = columnIdToProcessPatch(toColumn, columnMode);
    const position = Math.max(0, orderedIds.indexOf(processId));

    const { error } = await supabase
      .from("processes")
      .update({ ...patch, kanban_position: position } as any)
      .eq("id", processId);

    if (error) throw error;

    await Promise.all(
      orderedIds.map((id, idx) =>
        supabase.from("processes").update({ kanban_position: idx } as any).eq("id", id),
      ),
    );

    await supabase.from("audit_logs").insert({
      action: "process_kanban_moved",
      user_id: user.id,
      organization_id: activeOrgId,
      resource_type: "process",
      resource_id: processId,
      metadata: { from: fromColumn, to: toColumn, mode: columnMode },
    } as any);

    queryClient.invalidateQueries({ queryKey: ["process-kanban", activeOrgId] });
    queryClient.invalidateQueries({ queryKey: ["processes"] });
    setLocalProcesses(null);
  };

  return (
    <div className="space-y-6">
      <LexPageHeader
        overline="Gestão"
        title={
          <span className="flex items-center gap-2">
            <Columns3 className="h-7 w-7 text-primary shrink-0" />
            Kanban de Processos
          </span>
        }
        description="Acompanhe fases, status e responsáveis visualmente"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/processes"><List className="h-4 w-4" /> Ver lista</Link>
            </Button>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(v) => v && setMode(v as KanbanColumnMode)}
              className="border border-border rounded-xl p-0.5"
            >
              <ToggleGroupItem value="fase" className="rounded-lg text-xs px-3">Fase</ToggleGroupItem>
              <ToggleGroupItem value="status" className="rounded-lg text-xs px-3">Status</ToggleGroupItem>
            </ToggleGroup>
          </>
        }
      />

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar número, título ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl bg-muted border-border"
          />
        </div>
        <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
          <SelectTrigger className="w-full lg:w-[180px] rounded-xl bg-muted border-border"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos responsáveis</SelectItem>
            {orgMembers.map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full lg:w-[150px] rounded-xl bg-muted border-border"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            {PROCESS_TYPE_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-full lg:w-[140px] rounded-xl bg-muted border-border"><SelectValue placeholder="Risco" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos riscos</SelectItem>
            {PROCESS_RISK_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!canManage && (
        <p className="text-caption text-muted-foreground bg-muted/40 border border-border rounded-xl px-3 py-2">
          Modo somente leitura — você não tem permissão para mover processos.
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground text-body-sm">
          Carregando kanban...
        </div>
      ) : (
        <ProcessKanbanBoard
          processes={filteredProcesses}
          mode={mode}
          members={orgMembers}
          deadlineMap={deadlineMap}
          draggable={canManage}
          onProcessClick={openProcess}
          onProcessesChange={setLocalProcesses}
          onPersistMove={handlePersistMove}
        />
      )}

      <ProcessDetailsDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        process={selectedProcess}
        getMemberName={getMemberName}
        activeOrgId={activeOrgId}
      />
    </div>
  );
};

export default ProcessKanban;
