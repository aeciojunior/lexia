import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ListTodo, GripVertical, Flag } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Priority = "low" | "medium" | "high" | "urgent";

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; dot: string }> = {
  urgent: { label: "Urgente", color: "text-destructive", dot: "bg-destructive" },
  high: { label: "Alta", color: "text-warning", dot: "bg-warning" },
  medium: { label: "Média", color: "text-muted-foreground", dot: "bg-muted-foreground" },
  low: { label: "Baixa", color: "text-muted-foreground/60", dot: "bg-muted-foreground/60" },
};

interface TaskItem {
  id: string;
  title: string;
  done: boolean;
  priority: Priority;
  position: number;
}

const SortableTask = ({
  task,
  onToggle,
  onDelete,
  onPriorityChange,
}: {
  task: TaskItem;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onPriorityChange: (id: string, priority: Priority) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  };

  const prio = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2.5 rounded-lg transition-colors hover:bg-muted/30 group ${task.done ? "opacity-50" : ""} ${isDragging ? "bg-muted/40 shadow-lg" : ""}`}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground touch-none shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <Checkbox
        checked={task.done}
        onCheckedChange={(checked) => onToggle(task.id, !!checked)}
      />

      <span className={`flex-1 text-caption min-w-0 truncate ${task.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
        {task.title}
      </span>

      <Select
        value={task.priority}
        onValueChange={(v) => onPriorityChange(task.id, v as Priority)}
      >
        <SelectTrigger className="h-6 w-6 p-0 border-0 bg-transparent shadow-none [&>svg]:hidden shrink-0">
          <div className={`h-2 w-2 rounded-full ${prio.dot}`} title={prio.label} />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
            <SelectItem key={key} value={key}>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                <span>{cfg.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
        onClick={() => onDelete(task.id)}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
};

const QuickTasksWidget = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [newTask, setNewTask] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("medium");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: quickTasks = [] } = useQuery({
    queryKey: ["dash-quick-tasks", user?.id, activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_tasks" as any)
        .select("*")
        .eq("user_id", user!.id)
        .eq("organization_id", activeOrgId!)
        .order("position", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data as any[] as TaskItem[]) || [];
    },
    enabled: !!user && !!activeOrgId,
  });

  const addTask = useMutation({
    mutationFn: async ({ title, priority }: { title: string; priority: Priority }) => {
      const maxPos = quickTasks.length > 0 ? Math.max(...quickTasks.map(t => t.position || 0)) + 1 : 0;
      const { error } = await supabase.from("quick_tasks" as any).insert({
        title, priority, position: maxPos, user_id: user!.id, organization_id: activeOrgId!,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dash-quick-tasks"] }),
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("quick_tasks" as any).update({ done } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dash-quick-tasks"] }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; priority?: string; position?: number }) => {
      const { error } = await supabase.from("quick_tasks" as any).update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dash-quick-tasks"] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quick_tasks" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dash-quick-tasks"] }),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = quickTasks.findIndex(t => t.id === active.id);
    const newIndex = quickTasks.findIndex(t => t.id === over.id);
    const reordered = arrayMove(quickTasks, oldIndex, newIndex);

    // Optimistic update
    queryClient.setQueryData(["dash-quick-tasks", user?.id, activeOrgId], reordered);

    // Persist positions
    reordered.forEach((task, i) => {
      if (task.position !== i) {
        updateTask.mutate({ id: task.id, position: i });
      }
    });
  };

  const doneCount = quickTasks.filter(t => t.done).length;

  return (
    <LexCard hover={false}>
      <LexCardHeader>
        <LexCardTitle className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-primary" /> Tarefas Rápidas
        </LexCardTitle>
        <span className="text-caption text-muted-foreground">
          {doneCount}/{quickTasks.length} concluídas
        </span>
      </LexCardHeader>

      {/* Add task form */}
      <form
        className="flex gap-2 mb-4"
        onSubmit={e => {
          e.preventDefault();
          if (!newTask.trim()) return;
          addTask.mutate({ title: newTask.trim(), priority: newPriority });
          setNewTask("");
        }}
      >
        <Input
          placeholder="Nova tarefa..."
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          className="h-9 text-sm flex-1"
        />
        <Select value={newPriority} onValueChange={v => setNewPriority(v as Priority)}>
          <SelectTrigger className="h-9 w-9 p-0 border-border bg-transparent shadow-none flex items-center justify-center [&>svg]:hidden shrink-0">
            <Flag className={`h-3.5 w-3.5 ${PRIORITY_CONFIG[newPriority].color}`} />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                  <span>{cfg.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" variant="outline" disabled={!newTask.trim() || addTask.isPending}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </form>

      {quickTasks.length === 0 ? (
        <div className="py-8 text-center">
          <ListTodo className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-caption text-muted-foreground">Nenhuma tarefa ainda. Adicione uma acima!</p>
        </div>
      ) : (
        <ScrollArea className="max-h-72">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={quickTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {quickTasks.map(task => (
                  <SortableTask
                    key={task.id}
                    task={task}
                    onToggle={(id, done) => toggleTask.mutate({ id, done })}
                    onDelete={(id) => deleteTask.mutate(id)}
                    onPriorityChange={(id, priority) => updateTask.mutate({ id, priority })}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </ScrollArea>
      )}
    </LexCard>
  );
};

export default QuickTasksWidget;
