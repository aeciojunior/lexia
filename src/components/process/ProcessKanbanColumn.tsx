import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ProcessKanbanCard } from "./ProcessKanbanCard";
import type { DeadlineStats, KanbanProcess, OrgMemberOption } from "./processKanbanTypes";

interface ProcessKanbanColumnProps {
  columnId: string;
  label: string;
  processes: KanbanProcess[];
  members: OrgMemberOption[];
  deadlineMap: Record<string, DeadlineStats>;
  onProcessClick: (process: KanbanProcess) => void;
  draggable?: boolean;
  isOver?: boolean;
}

export function ProcessKanbanColumn({
  columnId,
  label,
  processes,
  members,
  deadlineMap,
  onProcessClick,
  draggable = true,
  isOver = false,
}: ProcessKanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: columnId });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-[280px] rounded-xl bg-muted/20 border border-border/60 p-2 transition-colors",
        isOver && "bg-primary/5 ring-1 ring-primary/25",
      )}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-caption font-semibold text-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {processes.length}
        </span>
      </div>

      <SortableContext items={processes.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <ScrollArea className="h-[calc(100vh-280px)] min-h-[320px]">
          <div className="space-y-2 pr-1">
            {processes.length === 0 ? (
              <div className="text-center py-8 text-[11px] text-muted-foreground/60 border border-dashed border-border rounded-lg">
                Arraste processos aqui
              </div>
            ) : (
              processes.map((process) => (
                <ProcessKanbanCard
                  key={process.id}
                  process={process}
                  members={members}
                  deadlineStats={deadlineMap[process.id]}
                  onClick={() => onProcessClick(process)}
                  draggable={draggable}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </SortableContext>
    </div>
  );
}
