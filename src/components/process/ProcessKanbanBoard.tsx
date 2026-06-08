import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import {
  columnIdToProcessPatch,
  getKanbanColumns,
  getProcessColumnId,
  type KanbanColumnMode,
} from "@/lib/processConstants";
import { ProcessKanbanCard } from "./ProcessKanbanCard";
import { ProcessKanbanColumn } from "./ProcessKanbanColumn";
import type { DeadlineStats, KanbanProcess, OrgMemberOption } from "./processKanbanTypes";

interface ProcessKanbanBoardProps {
  processes: KanbanProcess[];
  mode: KanbanColumnMode;
  members: OrgMemberOption[];
  deadlineMap: Record<string, DeadlineStats>;
  draggable?: boolean;
  onProcessClick: (process: KanbanProcess) => void;
  onProcessesChange: (next: KanbanProcess[]) => void;
  onPersistMove: (args: {
    processId: string;
    fromColumn: string;
    toColumn: string;
    mode: KanbanColumnMode;
    orderedIds: string[];
  }) => Promise<void>;
}

export function ProcessKanbanBoard({
  processes,
  mode,
  members,
  deadlineMap,
  draggable = true,
  onProcessClick,
  onProcessesChange,
  onPersistMove,
}: ProcessKanbanBoardProps) {
  const columns = useMemo(() => getKanbanColumns(mode), [mode]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const grouped = useMemo(() => {
    const map: Record<string, KanbanProcess[]> = {};
    for (const col of columns) map[col.id] = [];
    for (const process of processes) {
      const colId = getProcessColumnId(process, mode);
      if (!map[colId]) map[colId] = [];
      map[colId].push(process);
    }
    for (const col of columns) {
      map[col.id].sort((a, b) => a.kanban_position - b.kanban_position || a.created_at.localeCompare(b.created_at));
    }
    return map;
  }, [processes, columns, mode]);

  const activeProcess = activeId ? processes.find((p) => p.id === activeId) ?? null : null;

  const resolveColumnId = (id: string): string | null => {
    if (columns.some((c) => c.id === id)) return id;
    const process = processes.find((p) => p.id === id);
    return process ? getProcessColumnId(process, mode) : null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const col = event.over ? resolveColumnId(String(event.over.id)) : null;
    setOverColumnId(col);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    setOverColumnId(null);
    if (!draggable) return;

    const { active, over } = event;
    if (!over) return;

    const processId = String(active.id);
    const process = processes.find((p) => p.id === processId);
    if (!process) return;

    const fromColumn = getProcessColumnId(process, mode);
    const toColumn = resolveColumnId(String(over.id));
    if (!toColumn) return;

    const sourceItems = [...(grouped[fromColumn] || [])];
    const destItems = fromColumn === toColumn ? sourceItems : [...(grouped[toColumn] || [])];

    const fromIndex = sourceItems.findIndex((p) => p.id === processId);
    if (fromIndex < 0) return;

    let nextProcesses = [...processes];

    if (fromColumn === toColumn) {
      const overIndex = destItems.findIndex((p) => p.id === String(over.id));
      const toIndex = overIndex >= 0 ? overIndex : destItems.length - 1;
      const reordered = arrayMove(destItems, fromIndex, toIndex);
      nextProcesses = nextProcesses.map((p) => {
        if (getProcessColumnId(p, mode) !== fromColumn) return p;
        const idx = reordered.findIndex((r) => r.id === p.id);
        return idx >= 0 ? { ...p, kanban_position: idx } : p;
      });

      const previous = processes;
      onProcessesChange(nextProcesses);
      try {
        await onPersistMove({
          processId,
          fromColumn,
          toColumn,
          mode,
          orderedIds: reordered.map((p) => p.id),
        });
      } catch (err: any) {
        onProcessesChange(previous);
        toast.error(err?.message || "Erro ao reordenar processo");
      }
      return;
    }

    if ((toColumn === "Arquivado" || toColumn === "closed") && !window.confirm("Mover para coluna de encerramento/arquivamento?")) {
      return;
    }

    {
      const patch = columnIdToProcessPatch(toColumn, mode);
      const moved: KanbanProcess = {
        ...process,
        ...patch,
        kanban_position: destItems.length,
      };

      const without = nextProcesses.filter((p) => p.id !== processId);
      const updatedSource = sourceItems
        .filter((p) => p.id !== processId)
        .map((p, idx) => ({ ...p, kanban_position: idx }));

      nextProcesses = without.map((p) => {
        const srcIdx = updatedSource.findIndex((s) => s.id === p.id);
        if (srcIdx >= 0) return updatedSource[srcIdx];
        return p;
      });
      nextProcesses.push(moved);
    }

    const previous = processes;
    onProcessesChange(nextProcesses);

    try {
      const orderedIds = nextProcesses
        .filter((p) => getProcessColumnId(p, mode) === toColumn)
        .sort((a, b) => a.kanban_position - b.kanban_position)
        .map((p) => p.id);

      await onPersistMove({
        processId,
        fromColumn,
        toColumn,
        mode,
        orderedIds,
      });
    } catch (err: any) {
      onProcessesChange(previous);
      toast.error(err?.message || "Erro ao mover processo");
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[420px]">
        {columns.map((col) => (
          <ProcessKanbanColumn
            key={col.id}
            columnId={col.id}
            label={col.label}
            processes={grouped[col.id] || []}
            members={members}
            deadlineMap={deadlineMap}
            onProcessClick={onProcessClick}
            draggable={draggable}
            isOver={overColumnId === col.id}
          />
        ))}
      </div>

      <DragOverlay>
        {activeProcess && (
          <ProcessKanbanCard
            process={activeProcess}
            members={members}
            deadlineStats={deadlineMap[activeProcess.id]}
            onClick={() => undefined}
            draggable={false}
            isDragOverlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
