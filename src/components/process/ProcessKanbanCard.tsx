import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RiskIndicator } from "@/components/lexia/LegalComponents";
import { cn } from "@/lib/utils";
import { typeMap } from "@/lib/processConstants";
import type { DeadlineStats, KanbanProcess, OrgMemberOption } from "./processKanbanTypes";

interface ProcessKanbanCardProps {
  process: KanbanProcess;
  members: OrgMemberOption[];
  deadlineStats?: DeadlineStats;
  onClick: () => void;
  draggable?: boolean;
  isDragOverlay?: boolean;
}

export function ProcessKanbanCard({
  process,
  members,
  deadlineStats,
  onClick,
  draggable = true,
  isDragOverlay = false,
}: ProcessKanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: process.id,
    disabled: !draggable,
    data: { type: "process-card", processId: process.id },
  });

  const responsible = members.find((m) => m.user_id === process.responsible_id);
  const style = isDragOverlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : undefined,
      };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border border-border bg-card/80 p-3 space-y-2 group hover:border-primary/30 transition-colors",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragOverlay && "shadow-lg border-primary/30 rotate-1",
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {draggable && (
          <button
            type="button"
            className="mt-0.5 text-muted-foreground/50 hover:text-muted-foreground shrink-0"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-mono text-primary truncate">{process.number}</p>
          <p className="text-caption font-medium leading-snug line-clamp-2">{process.title}</p>
        </div>
        <RiskIndicator level={process.risk_level || "low"} />
      </div>

      <p className="text-[11px] text-muted-foreground truncate pl-5">{process.client_name}</p>

      <div className="flex items-center justify-between gap-2 pl-5">
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
          {typeMap[process.type] || process.type}
        </Badge>
        <div className="flex items-center gap-1.5">
          {deadlineStats && deadlineStats.overdue > 0 && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 gap-0.5">
              <AlertTriangle className="h-2.5 w-2.5" />
              {deadlineStats.overdue}
            </Badge>
          )}
          {deadlineStats && deadlineStats.pending > 0 && deadlineStats.overdue === 0 && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
              {deadlineStats.pending} prazo{deadlineStats.pending > 1 ? "s" : ""}
            </Badge>
          )}
          {responsible ? (
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                {responsible.full_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <span className="text-[10px] text-muted-foreground/60">—</span>
          )}
        </div>
      </div>
    </div>
  );
}
