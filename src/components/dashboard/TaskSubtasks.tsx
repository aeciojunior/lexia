import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface Subtask {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  position: number;
}

const TaskSubtasks = ({ taskId }: { taskId: string }) => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");

  const { data: subtasks = [] } = useQuery({
    queryKey: ["task-subtasks", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_task_subtasks" as any)
        .select("*")
        .eq("task_id", taskId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data as any[] as Subtask[]) || [];
    },
  });

  const addSubtask = useMutation({
    mutationFn: async (title: string) => {
      const maxPos = subtasks.length > 0 ? Math.max(...subtasks.map(s => s.position)) + 1 : 0;
      const { error } = await supabase.from("quick_task_subtasks" as any).insert({
        task_id: taskId,
        user_id: user!.id,
        organization_id: activeOrgId!,
        title,
        position: maxPos,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-subtasks", taskId] });
      setNewTitle("");
    },
  });

  const toggleSubtask = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("quick_task_subtasks" as any).update({ done } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task-subtasks", taskId] }),
  });

  const deleteSubtask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quick_task_subtasks" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task-subtasks", taskId] }),
  });

  const doneCount = subtasks.filter(s => s.done).length;
  const total = subtasks.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="pl-8 pr-2 pb-2 space-y-1.5">
      {total > 0 && (
        <div className="flex items-center gap-2">
          <Progress value={pct} className="h-1.5 flex-1" />
          <span className="text-[9px] text-muted-foreground shrink-0">{doneCount}/{total}</span>
        </div>
      )}

      {subtasks.map(s => (
        <div key={s.id} className="flex items-center gap-2 group/sub">
          <Checkbox
            checked={s.done}
            onCheckedChange={(checked) => toggleSubtask.mutate({ id: s.id, done: !!checked })}
            className="h-3.5 w-3.5"
          />
          <span className={cn("flex-1 text-[11px]", s.done && "line-through text-muted-foreground")}>
            {s.title}
          </span>
          <Button
            variant="ghost" size="icon"
            className="h-5 w-5 opacity-0 group-hover/sub:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => deleteSubtask.mutate(s.id)}
          >
            <Trash2 className="h-2.5 w-2.5" />
          </Button>
        </div>
      ))}

      <form
        className="flex items-center gap-1.5"
        onSubmit={e => {
          e.preventDefault();
          if (newTitle.trim()) addSubtask.mutate(newTitle.trim());
        }}
      >
        <Input
          placeholder="Nova subtarefa..."
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          className="h-6 text-[11px] flex-1"
        />
        <Button type="submit" variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-primary" disabled={!newTitle.trim()}>
          <Plus className="h-3 w-3" />
        </Button>
      </form>
    </div>
  );
};

export default TaskSubtasks;
