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
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Plus, Trash2, ListTodo, GripVertical, Flag, CalendarIcon } from "lucide-react";
import { format, isPast, isToday, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Priority = "low" | "medium" | "high" | "urgent";
type PriorityFilter = "all" | Priority;

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
  due_date: string | null;
}

const DueDateLabel = ({ dueDate }: { dueDate: string | null }) => {
  if (!dueDate) return null;
  const date = new Date(dueDate + "T00:00:00");
  const overdue = isPast(date) && !isToday(date);
  const today = isToday(date);
  const days = differenceInDays(date, new Date());

  return (
    <span className={cn(
      "text-[10px] shrink-0",
      overdue ? "text-destructive font-medium" : today ? "text-warning font-medium" : "text-muted-foreground"
    )}>
      {format(date, "dd MMM", { locale: ptBR })}
      {overdue && " ⚠"}
    </span>
  );
};

const SortableTask = ({
  task, onToggle, onDelete, onPriorityChange, onDueDateChange,
}: {
  task: TaskItem;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onPriorityChange: (id: string, priority: Priority) => void;
  onDueDateChange: (id: string, date: string | null) => void;
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
      className={cn(
        "flex items-center gap-2 p-2.5 rounded-lg transition-colors hover:bg-muted/30 group",
        task.done && "opacity-50",
        isDragging && "bg-muted/40 shadow-lg",
      )}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground touch-none shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <Checkbox checked={task.done} onCheckedChange={(checked) => onToggle(task.id, !!checked)} />

      <span className={cn("flex-1 text-caption min-w-0 truncate", task.done ? "line-through text-muted-foreground" : "text-foreground")}>
        {task.title}
      </span>

      <DueDateLabel dueDate={task.due_date} />

      {/* Due date picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground/50 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            <CalendarIcon className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={task.due_date ? new Date(task.due_date + "T00:00:00") : undefined}
            onSelect={(d) => onDueDateChange(task.id, d ? format(d, "yyyy-MM-dd") : null)}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
          {task.due_date && (
            <div className="px-3 pb-3">
              <Button variant="ghost" size="sm" className="w-full text-xs text-destructive" onClick={() => onDueDateChange(task.id, null)}>
                Remover data
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Priority */}
      <Select value={task.priority} onValueChange={(v) => onPriorityChange(task.id, v as Priority)}>
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
  const [newDueDate, setNewDueDate] = useState<Date | undefined>();
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");

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
    mutationFn: async ({ title, priority, due_date }: { title: string; priority: Priority; due_date?: string | null }) => {
      const maxPos = quickTasks.length > 0 ? Math.max(...quickTasks.map(t => t.position || 0)) + 1 : 0;
      const { error } = await supabase.from("quick_tasks" as any).insert({
        title, priority, position: maxPos, due_date: due_date || null,
        user_id: user!.id, organization_id: activeOrgId!,
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
    mutationFn: async ({ id, ...updates }: { id: string; priority?: string; position?: number; due_date?: string | null }) => {
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
    const oldIndex = filteredTasks.findIndex(t => t.id === active.id);
    const newIndex = filteredTasks.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(quickTasks, quickTasks.findIndex(t => t.id === active.id), quickTasks.findIndex(t => t.id === over.id));
    queryClient.setQueryData(["dash-quick-tasks", user?.id, activeOrgId], reordered);
    reordered.forEach((task, i) => {
      if (task.position !== i) updateTask.mutate({ id: task.id, position: i });
    });
  };

  const filteredTasks = priorityFilter === "all"
    ? quickTasks
    : quickTasks.filter(t => t.priority === priorityFilter);

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

      {/* Priority filter */}
      <div className="mb-3">
        <ToggleGroup type="single" value={priorityFilter} onValueChange={v => v && setPriorityFilter(v as PriorityFilter)} size="sm" className="justify-start">
          <ToggleGroupItem value="all" className="text-xs px-2.5 h-7">Todas</ToggleGroupItem>
          {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
            <ToggleGroupItem key={key} value={key} className="text-xs px-2.5 h-7 gap-1">
              <div className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Add task form */}
      <form
        className="flex gap-2 mb-4"
        onSubmit={e => {
          e.preventDefault();
          if (!newTask.trim()) return;
          addTask.mutate({
            title: newTask.trim(),
            priority: newPriority,
            due_date: newDueDate ? format(newDueDate, "yyyy-MM-dd") : null,
          });
          setNewTask("");
          setNewDueDate(undefined);
        }}
      >
        <Input
          placeholder="Nova tarefa..."
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          className="h-9 text-sm flex-1"
        />

        {/* Due date for new task */}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="icon" className={cn("h-9 w-9 shrink-0", newDueDate && "text-primary border-primary/40")}>
              <CalendarIcon className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={newDueDate}
              onSelect={setNewDueDate}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

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

      {newDueDate && (
        <div className="flex items-center gap-1.5 mb-3 -mt-2">
          <span className="text-[10px] text-muted-foreground">Vencimento:</span>
          <span className="text-[10px] text-primary font-medium">{format(newDueDate, "dd MMM yyyy", { locale: ptBR })}</span>
          <Button type="button" variant="ghost" size="icon" className="h-4 w-4" onClick={() => setNewDueDate(undefined)}>
            <Trash2 className="h-2.5 w-2.5 text-muted-foreground" />
          </Button>
        </div>
      )}

      {filteredTasks.length === 0 ? (
        <div className="py-8 text-center">
          <ListTodo className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-caption text-muted-foreground">
            {quickTasks.length === 0 ? "Nenhuma tarefa ainda. Adicione uma acima!" : "Nenhuma tarefa com essa prioridade."}
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-72">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {filteredTasks.map(task => (
                  <SortableTask
                    key={task.id}
                    task={task}
                    onToggle={(id, done) => toggleTask.mutate({ id, done })}
                    onDelete={(id) => deleteTask.mutate(id)}
                    onPriorityChange={(id, priority) => updateTask.mutate({ id, priority })}
                    onDueDateChange={(id, due_date) => updateTask.mutate({ id, due_date })}
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
