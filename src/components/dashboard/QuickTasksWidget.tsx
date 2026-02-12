import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Trash2, ListTodo, GripVertical, Flag, CalendarIcon, UserPlus,
  MessageSquare, Send, Columns3, List, ChevronDown, ChevronUp, ListChecks, Tag, X, Download, Settings, Palette,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import TaskProgressChart from "./TaskProgressChart";
import TaskSubtasks from "./TaskSubtasks";
import { format, isPast, isToday, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent, DragOverlay, type DragStartEvent,
  useDroppable, type DragOverEvent, pointerWithin,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Priority = "low" | "medium" | "high" | "urgent";
type PriorityFilter = "all" | Priority;
type TaskStatus = "todo" | "in_progress" | "done";

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; dot: string }> = {
  urgent: { label: "Urgente", color: "text-destructive", dot: "bg-destructive" },
  high: { label: "Alta", color: "text-warning", dot: "bg-warning" },
  medium: { label: "Média", color: "text-muted-foreground", dot: "bg-muted-foreground" },
  low: { label: "Baixa", color: "text-muted-foreground/60", dot: "bg-muted-foreground/60" },
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  todo: { label: "A fazer", color: "text-muted-foreground" },
  in_progress: { label: "Em progresso", color: "text-warning" },
  done: { label: "Concluído", color: "text-accent" },
};

const TAG_COLORS: { bg: string; text: string; border: string }[] = [
  { bg: "bg-blue-500/15", text: "text-blue-700 dark:text-blue-300", border: "border-blue-500/30" },
  { bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-500/30" },
  { bg: "bg-amber-500/15", text: "text-amber-700 dark:text-amber-300", border: "border-amber-500/30" },
  { bg: "bg-purple-500/15", text: "text-purple-700 dark:text-purple-300", border: "border-purple-500/30" },
  { bg: "bg-rose-500/15", text: "text-rose-700 dark:text-rose-300", border: "border-rose-500/30" },
  { bg: "bg-cyan-500/15", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-500/30" },
  { bg: "bg-orange-500/15", text: "text-orange-700 dark:text-orange-300", border: "border-orange-500/30" },
  { bg: "bg-pink-500/15", text: "text-pink-700 dark:text-pink-300", border: "border-pink-500/30" },
];

const PRESET_HEX_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444",
  "#06b6d4", "#f97316", "#ec4899", "#14b8a6", "#6366f1",
  "#84cc16", "#e11d48",
];

const getTagColor = (tag: string) => {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
};

interface PredefTag {
  id: string;
  name: string;
  color: string;
  organization_id: string;
  created_by: string;
}

const TagBadge = ({ tag, customColor, onRemove }: { tag: string; customColor?: string; onRemove?: () => void }) => {
  if (customColor) {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[9px] font-medium border"
        style={{
          backgroundColor: `${customColor}20`,
          color: customColor,
          borderColor: `${customColor}50`,
        }}
      >
        {tag}
        {onRemove && (
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="hover:opacity-70">
            <X className="h-2 w-2" />
          </button>
        )}
      </span>
    );
  }
  const color = getTagColor(tag);
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[9px] font-medium border", color.bg, color.text, color.border)}>
      {tag}
      {onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="hover:opacity-70">
          <X className="h-2 w-2" />
        </button>
      )}
    </span>
  );
};

const TagEditor = ({ tags, onUpdate, predefinedTags }: { tags: string[]; onUpdate: (tags: string[]) => void; predefinedTags: PredefTag[] }) => {
  const [newTag, setNewTag] = useState("");
  const availablePredef = predefinedTags.filter(pt => !tags.includes(pt.name));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {tags.map(tag => {
          const predef = predefinedTags.find(pt => pt.name === tag);
          return <TagBadge key={tag} tag={tag} customColor={predef?.color} onRemove={() => onUpdate(tags.filter(t => t !== tag))} />;
        })}
      </div>
      {availablePredef.length > 0 && (
        <div className="space-y-1">
          <span className="text-[9px] text-muted-foreground font-medium">Tags disponíveis:</span>
          <div className="flex flex-wrap gap-1">
            {availablePredef.map(pt => (
              <button
                key={pt.id}
                className="rounded-full px-1.5 py-0.5 text-[9px] font-medium border cursor-pointer hover:opacity-80 transition-opacity"
                style={{
                  backgroundColor: `${pt.color}20`,
                  color: pt.color,
                  borderColor: `${pt.color}50`,
                }}
                onClick={() => onUpdate([...tags, pt.name])}
              >
                + {pt.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <form
        className="flex gap-1"
        onSubmit={e => {
          e.preventDefault();
          const t = newTag.trim().toLowerCase();
          if (t && !tags.includes(t)) { onUpdate([...tags, t]); setNewTag(""); }
        }}
      >
        <Input placeholder="Tag personalizada..." value={newTag} onChange={e => setNewTag(e.target.value)} className="h-6 text-[10px] flex-1" />
        <Button type="submit" variant="ghost" size="icon" className="h-6 w-6 text-primary shrink-0" disabled={!newTag.trim()}>
          <Plus className="h-2.5 w-2.5" />
        </Button>
      </form>
    </div>
  );
};

/* ─── Tag Management Dialog ─── */
const TagManager = ({ orgId, userId }: { orgId: string; userId: string }) => {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_HEX_COLORS[0]);

  const { data: tags = [] } = useQuery({
    queryKey: ["predefined-tags", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_task_tags" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("name");
      if (error) throw error;
      return (data as any[] as PredefTag[]) || [];
    },
    enabled: !!orgId,
  });

  const addTag = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("quick_task_tags" as any).insert({
        name: newName.trim().toLowerCase(),
        color: newColor,
        organization_id: orgId,
        created_by: userId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predefined-tags", orgId] });
      setNewName("");
      toast.success("Tag criada!");
    },
    onError: (err: any) => {
      if (err.message?.includes("duplicate") || err.code === "23505") {
        toast.error("Já existe uma tag com esse nome.");
      } else {
        toast.error("Erro ao criar tag.");
      }
    },
  });

  const deleteTag = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quick_task_tags" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predefined-tags", orgId] });
      toast.success("Tag removida.");
    },
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {tags.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">Nenhuma tag criada ainda.</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {tags.map(tag => (
              <div key={tag.id} className="flex items-center gap-2 group/tag">
                <span
                  className="h-3 w-3 rounded-full shrink-0 border"
                  style={{ backgroundColor: tag.color, borderColor: `${tag.color}80` }}
                />
                <span className="text-sm flex-1">{tag.name}</span>
                <Button
                  variant="ghost" size="icon"
                  className="h-6 w-6 opacity-0 group-hover/tag:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => deleteTag.mutate(tag.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <form
        className="space-y-2"
        onSubmit={e => {
          e.preventDefault();
          if (newName.trim()) addTag.mutate();
        }}
      >
        <div className="flex gap-2">
          <Input
            placeholder="Nome da tag..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="h-8 text-xs flex-1"
          />
          <Button type="submit" size="sm" className="h-8" disabled={!newName.trim() || addTag.isPending}>
            <Plus className="h-3 w-3 mr-1" /> Criar
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_HEX_COLORS.map(c => (
            <button
              key={c}
              type="button"
              className={cn(
                "h-5 w-5 rounded-full border-2 transition-all",
                newColor === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"
              )}
              style={{ backgroundColor: c }}
              onClick={() => setNewColor(c)}
            />
          ))}
        </div>
      </form>
    </div>
  );
};
interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  done: boolean;
  priority: Priority;
  position: number;
  due_date: string | null;
  user_id: string;
  assigned_to: string | null;
  status: TaskStatus;
  tags: string[];
}

interface OrgMember {
  user_id: string;
  full_name: string | null;
}

interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

/* ─── Sub-components ─── */

const DueDateLabel = ({ dueDate }: { dueDate: string | null }) => {
  if (!dueDate) return null;
  const date = new Date(dueDate + "T00:00:00");
  const overdue = isPast(date) && !isToday(date);
  const today = isToday(date);
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

const MemberAvatar = ({ member, size = "xs" }: { member: OrgMember | undefined; size?: "xs" | "sm" }) => {
  if (!member) return null;
  const initials = (member.full_name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Avatar className={size === "xs" ? "h-5 w-5" : "h-6 w-6"}>
            <AvatarFallback className="text-[8px] bg-secondary/20 text-secondary">{initials}</AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent><p>{member.full_name || "Sem nome"}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/* ─── Comments Section ─── */
const TaskComments = ({ taskId, members }: { taskId: string; members: OrgMember[] }) => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");

  const { data: comments = [] } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_task_comments" as any)
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[] as TaskComment[]) || [];
    },
  });

  const addComment = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.from("quick_task_comments" as any).insert({
        task_id: taskId,
        user_id: user!.id,
        organization_id: activeOrgId!,
        content: text,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] });
      setContent("");
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quick_task_comments" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] }),
  });

  return (
    <div className="pl-8 pr-2 pb-2 space-y-2">
      {comments.map(c => {
        const author = members.find(m => m.user_id === c.user_id);
        return (
          <div key={c.id} className="flex items-start gap-2 group/comment">
            <MemberAvatar member={author} size="xs" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-foreground">{author?.full_name || "Anônimo"}</span>
                <span className="text-[9px] text-muted-foreground">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{c.content}</p>
            </div>
            {c.user_id === user?.id && (
              <Button
                variant="ghost" size="icon"
                className="h-5 w-5 opacity-0 group-hover/comment:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => deleteComment.mutate(c.id)}
              >
                <Trash2 className="h-2.5 w-2.5" />
              </Button>
            )}
          </div>
        );
      })}
      <form
        className="flex items-center gap-1.5"
        onSubmit={e => {
          e.preventDefault();
          if (content.trim()) addComment.mutate(content.trim());
        }}
      >
        <Input
          placeholder="Adicionar nota..."
          value={content}
          onChange={e => setContent(e.target.value)}
          className="h-7 text-[11px] flex-1"
        />
        <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-primary" disabled={!content.trim()}>
          <Send className="h-3 w-3" />
        </Button>
      </form>
    </div>
  );
};

/* ─── Sortable Task (list view) ─── */
const SortableTask = ({
  task, members, onToggle, onDelete, onPriorityChange, onDueDateChange, onAssign, onStatusChange, onUpdateTitle, onUpdateDescription, onTagsChange, predefinedTags = [],
}: {
  task: TaskItem;
  members: OrgMember[];
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onPriorityChange: (id: string, priority: Priority) => void;
  onDueDateChange: (id: string, date: string | null) => void;
  onAssign: (id: string, userId: string | null) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onUpdateDescription: (id: string, description: string | null) => void;
  onTagsChange: (id: string, tags: string[]) => void;
  predefinedTags?: PredefTag[];
}) => {
  const [showComments, setShowComments] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [showDescription, setShowDescription] = useState(false);
  const [editDescription, setEditDescription] = useState(task.description || "");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  };
  const prio = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const assignedMember = members.find(m => m.user_id === task.assigned_to);

  return (
    <div ref={setNodeRef} style={style}>
      <div className={cn(
        "flex items-center gap-2 p-2.5 rounded-lg transition-colors hover:bg-muted/30 group",
        task.status === "done" && "opacity-50",
        isDragging && "bg-muted/40 shadow-lg",
      )}>
        <button className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground touch-none shrink-0" {...attributes} {...listeners}>
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <Checkbox
          checked={task.status === "done"}
          onCheckedChange={(checked) => {
            const newStatus: TaskStatus = checked ? "done" : "todo";
            onStatusChange(task.id, newStatus);
            onToggle(task.id, !!checked);
          }}
        />

        {isEditingTitle ? (
          <Input
            autoFocus
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={() => {
              setIsEditingTitle(false);
              if (editTitle.trim() && editTitle.trim() !== task.title) onUpdateTitle(task.id, editTitle.trim());
              else setEditTitle(task.title);
            }}
            onKeyDown={e => {
              if (e.key === "Enter") { e.currentTarget.blur(); }
              if (e.key === "Escape") { setEditTitle(task.title); setIsEditingTitle(false); }
            }}
            className="h-6 text-caption flex-1 min-w-0 px-1 py-0"
          />
        ) : (
          <span
            className={cn("flex-1 text-caption min-w-0 truncate cursor-text", task.status === "done" ? "line-through text-muted-foreground" : "text-foreground")}
            onClick={() => { setIsEditingTitle(true); setEditTitle(task.title); }}
          >
            {task.title}
          </span>
        )}

        <DueDateLabel dueDate={task.due_date} />
        {(task.tags || []).length > 0 && (
          <div className="flex items-center gap-0.5 shrink-0">
            {(task.tags || []).slice(0, 3).map(tag => {
              const pt = predefinedTags.find(p => p.name === tag);
              return <TagBadge key={tag} tag={tag} customColor={pt?.color} />;
            })}
            {(task.tags || []).length > 3 && <span className="text-[8px] text-muted-foreground">+{(task.tags || []).length - 3}</span>}
          </div>
        )}
        {assignedMember && <MemberAvatar member={assignedMember} />}

        {/* Status selector */}
        <Select value={task.status} onValueChange={(v) => onStatusChange(task.id, v as TaskStatus)}>
          <SelectTrigger className="h-6 px-1.5 text-[10px] w-auto min-w-0 border-0 bg-transparent shadow-none gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className={STATUS_CONFIG[task.status]?.color}>{STATUS_CONFIG[task.status]?.label}</span>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>
                <span className={cfg.color}>{cfg.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tags toggle */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost" size="icon"
              className={cn("h-6 w-6 shrink-0 text-muted-foreground/50 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity", (task.tags || []).length > 0 && "opacity-60")}
              title="Tags"
            >
              <Tag className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" align="end">
            <TagEditor tags={task.tags || []} onUpdate={(tags) => onTagsChange(task.id, tags)} predefinedTags={predefinedTags} />
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost" size="icon"
          className={cn("h-6 w-6 shrink-0 text-muted-foreground/50 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity", task.description && "opacity-60")}
          onClick={() => setShowDescription(!showDescription)}
          title="Descrição"
        >
          <ChevronDown className={cn("h-3 w-3 transition-transform", showDescription && "rotate-180")} />
        </Button>

        {/* Subtasks toggle */}
        <Button
          variant="ghost" size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground/50 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => setShowSubtasks(!showSubtasks)}
        >
          <ListChecks className="h-3 w-3" />
        </Button>

        {/* Comments toggle */}
        <Button
          variant="ghost" size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground/50 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => setShowComments(!showComments)}
        >
          <MessageSquare className="h-3 w-3" />
        </Button>

        {/* Assign */}
        <Select value={task.assigned_to || "__none__"} onValueChange={(v) => onAssign(task.id, v === "__none__" ? null : v)}>
          <SelectTrigger className="h-6 w-6 p-0 border-0 bg-transparent shadow-none [&>svg]:hidden shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <UserPlus className="h-3 w-3 text-muted-foreground" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sem atribuição</SelectItem>
            {members.map(m => (
              <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || "Sem nome"}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Due date */}
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
              className="p-3 pointer-events-auto"
            />
            {task.due_date && (
              <div className="px-3 pb-3">
                <Button variant="ghost" size="sm" className="w-full text-xs text-destructive" onClick={() => onDueDateChange(task.id, null)}>Remover data</Button>
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
          variant="ghost" size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
          onClick={() => onDelete(task.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Description */}
      {showDescription && (
        <div className="pl-8 pr-2 pb-2">
          <Textarea
            placeholder="Adicionar descrição..."
            value={editDescription}
            onChange={e => setEditDescription(e.target.value)}
            onBlur={() => {
              const val = editDescription.trim() || null;
              if (val !== (task.description || null)) onUpdateDescription(task.id, val);
            }}
            className="text-[11px] min-h-[48px] resize-none"
            rows={2}
          />
        </div>
      )}

      {showSubtasks && <TaskSubtasks taskId={task.id} />}
      {showComments && <TaskComments taskId={task.id} members={members} />}
    </div>
  );
};

/* ─── Draggable Kanban Card ─── */
const DraggableKanbanCard = ({
  task, members, onDelete, onStatusChange, onUpdateTitle, onUpdateDescription, isDragOverlay = false,
}: {
  task: TaskItem;
  members: OrgMember[];
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onUpdateTitle?: (id: string, title: string) => void;
  onUpdateDescription?: (id: string, description: string | null) => void;
  isDragOverlay?: boolean;
}) => {
  const [showComments, setShowComments] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [showDescription, setShowDescription] = useState(false);
  const [editDescription, setEditDescription] = useState(task.description || "");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "kanban-card", status: task.status },
  });
  const style = isDragOverlay ? {} : {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : undefined,
  };
  const prio = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const assignedMember = members.find(m => m.user_id === task.assigned_to);

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className={cn(
        "rounded-lg border border-border bg-card/60 p-2.5 space-y-1.5 group hover:border-primary/20 transition-colors cursor-grab active:cursor-grabbing",
        isDragOverlay && "shadow-lg border-primary/30 bg-card",
      )}
    >
      <div className="flex items-start gap-2">
        <div className={`h-2 w-2 rounded-full mt-1 shrink-0 ${prio.dot}`} />
        {isEditingTitle ? (
          <div onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
            <Input
              autoFocus
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onBlur={() => {
                setIsEditingTitle(false);
                if (editTitle.trim() && editTitle.trim() !== task.title) onUpdateTitle?.(task.id, editTitle.trim());
                else setEditTitle(task.title);
              }}
              onKeyDown={e => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") { setEditTitle(task.title); setIsEditingTitle(false); }
              }}
              className="h-5 text-caption flex-1 min-w-0 px-1 py-0"
            />
          </div>
        ) : (
          <span
            className={cn("flex-1 text-caption leading-snug cursor-text", task.status === "done" && "line-through text-muted-foreground")}
            onClick={(e) => { e.stopPropagation(); setIsEditingTitle(true); setEditTitle(task.title); }}
            onPointerDown={e => { if (!isDragOverlay) e.stopPropagation(); }}
          >
            {task.title}
          </span>
        )}
        <Button
          variant="ghost" size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
        >
          <Trash2 className="h-2.5 w-2.5" />
        </Button>
      </div>

      {/* Tags */}
      {(task.tags || []).length > 0 && (
        <div className="flex flex-wrap gap-0.5 pl-4">
          {(task.tags || []).map(tag => {
            // Note: predefinedTags not available in kanban card context, use hash-based colors
            return <TagBadge key={tag} tag={tag} />;
          })}
        </div>
      )}

      {task.description && !showDescription && (
        <p
          className="text-[10px] text-muted-foreground truncate pl-4 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); setShowDescription(true); }}
          onPointerDown={e => e.stopPropagation()}
        >
          {task.description}
        </p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        <DueDateLabel dueDate={task.due_date} />
        {assignedMember && <MemberAvatar member={assignedMember} />}

        <Button
          variant="ghost" size="icon"
          className="h-5 w-5 shrink-0 text-muted-foreground/50 hover:text-primary"
          onClick={(e) => { e.stopPropagation(); setShowSubtasks(!showSubtasks); }}
        >
          <ListChecks className="h-2.5 w-2.5" />
        </Button>

        <Button
          variant="ghost" size="icon"
          className={cn("h-5 w-5 shrink-0 text-muted-foreground/50 hover:text-primary", task.description && "text-muted-foreground")}
          onClick={(e) => { e.stopPropagation(); setShowDescription(!showDescription); }}
          onPointerDown={e => e.stopPropagation()}
        >
          <ChevronDown className={cn("h-2.5 w-2.5 transition-transform", showDescription && "rotate-180")} />
        </Button>

        <Button
          variant="ghost" size="icon"
          className="h-5 w-5 shrink-0 text-muted-foreground/50 hover:text-primary ml-auto"
          onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}
        >
          <MessageSquare className="h-2.5 w-2.5" />
        </Button>
      </div>

      {showDescription && (
        <div onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
          <Textarea
            placeholder="Adicionar descrição..."
            value={editDescription}
            onChange={e => setEditDescription(e.target.value)}
            onBlur={() => {
              const val = editDescription.trim() || null;
              if (val !== (task.description || null)) onUpdateDescription?.(task.id, val);
            }}
            className="text-[11px] min-h-[40px] resize-none"
            rows={2}
          />
        </div>
      )}

      {showSubtasks && (
        <div onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
          <TaskSubtasks taskId={task.id} />
        </div>
      )}

      {showComments && (
        <div onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
          <TaskComments taskId={task.id} members={members} />
        </div>
      )}
    </div>
  );
};

/* ─── Droppable Kanban Column ─── */
const DroppableKanbanColumn = ({
  status, tasks, members, onDelete, onStatusChange, onUpdateTitle, onUpdateDescription, isOver,
}: {
  status: TaskStatus;
  tasks: TaskItem[];
  members: OrgMember[];
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onUpdateDescription: (id: string, description: string | null) => void;
  isOver?: boolean;
}) => {
  const { setNodeRef } = useDroppable({ id: status });
  const cfg = STATUS_CONFIG[status];
  return (
    <div ref={setNodeRef} className={cn("flex-1 min-w-[200px] rounded-lg p-1 transition-colors", isOver && "bg-primary/5 ring-1 ring-primary/20")}>
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className={cn("text-caption font-semibold", cfg.color)}>{cfg.label}</span>
        <span className="text-[10px] text-muted-foreground bg-muted/50 rounded-full px-1.5">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <ScrollArea className="max-h-64">
          <div className="space-y-1.5 pr-1">
            {tasks.length === 0 ? (
              <div className="text-center py-4 text-[10px] text-muted-foreground/50 border border-dashed border-border rounded-lg">
                Arraste tarefas aqui
              </div>
            ) : (
              tasks.map(task => (
                <DraggableKanbanCard
                  key={task.id}
                  task={task}
                  members={members}
                  onDelete={onDelete}
                  onStatusChange={onStatusChange}
                  onUpdateTitle={onUpdateTitle}
                  onUpdateDescription={onUpdateDescription}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </SortableContext>
    </div>
  );
};

/* ─── Main Widget ─── */
const QuickTasksWidget = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [newTask, setNewTask] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [newDueDate, setNewDueDate] = useState<Date | undefined>();
  const [newAssignee, setNewAssignee] = useState<string>("__none__");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: orgMembers = [] } = useQuery({
    queryKey: ["org-members-for-tasks", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_organizations")
        .select("user_id")
        .eq("organization_id", activeOrgId!);
      if (error) throw error;
      const userIds = (data || []).map((d: any) => d.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      if (pErr) throw pErr;
      return (profiles as OrgMember[]) || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: quickTasks = [] } = useQuery({
    queryKey: ["dash-quick-tasks", user?.id, activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_tasks" as any)
        .select("*")
        .eq("organization_id", activeOrgId!)
        .or(`user_id.eq.${user!.id},assigned_to.eq.${user!.id}`)
        .order("position", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as any[] as TaskItem[]) || [];
    },
    enabled: !!user && !!activeOrgId,
  });

  // Predefined tags for this org
  const { data: predefinedTags = [] } = useQuery({
    queryKey: ["predefined-tags", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_task_tags" as any)
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("name");
      if (error) throw error;
      return (data as any[] as PredefTag[]) || [];
    },
    enabled: !!activeOrgId,
  });

  // Helper to send assignment notification
  const sendAssignmentNotification = useCallback(async (assignedTo: string, taskTitle: string) => {
    if (!assignedTo || assignedTo === user?.id || !activeOrgId) return;
    const assignerName = orgMembers.find(m => m.user_id === user?.id)?.full_name || "Alguém";
    await supabase.from("notifications").insert({
      user_id: assignedTo,
      organization_id: activeOrgId,
      type: "task_assigned",
      title: "Tarefa atribuída a você",
      message: `${assignerName} atribuiu a tarefa "${taskTitle}" a você.`,
      resource_type: "quick_task",
    });
  }, [user?.id, activeOrgId, orgMembers]);

  const addTask = useMutation({
    mutationFn: async ({ title, priority, due_date, assigned_to }: { title: string; priority: Priority; due_date?: string | null; assigned_to?: string | null }) => {
      const maxPos = quickTasks.length > 0 ? Math.max(...quickTasks.map(t => t.position || 0)) + 1 : 0;
      const { error } = await supabase.from("quick_tasks" as any).insert({
        title, priority, position: maxPos, due_date: due_date || null,
        assigned_to: assigned_to || null, status: "todo",
        user_id: user!.id, organization_id: activeOrgId!,
      } as any);
      if (error) throw error;
      if (assigned_to && assigned_to !== user!.id) {
        await sendAssignmentNotification(assigned_to, title);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dash-quick-tasks"] }),
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("quick_tasks" as any).update({ done, status: done ? "done" : "todo" } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dash-quick-tasks"] }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; priority?: string; position?: number; due_date?: string | null; assigned_to?: string | null; status?: string; title?: string; description?: string | null; tags?: string[] }) => {
      const payload: any = { ...updates };
      if (updates.status === "done") payload.done = true;
      else if (updates.status) payload.done = false;
      const { error } = await supabase.from("quick_tasks" as any).update(payload).eq("id", id);
      if (error) throw error;
      // Send notification if assigned_to changed
      if (updates.assigned_to && updates.assigned_to !== user!.id) {
        const task = quickTasks.find(t => t.id === id);
        if (task && task.assigned_to !== updates.assigned_to) {
          await sendAssignmentNotification(updates.assigned_to, task.title);
        }
      }
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
    const oldIdx = quickTasks.findIndex(t => t.id === active.id);
    const newIdx = quickTasks.findIndex(t => t.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(quickTasks, oldIdx, newIdx);
    queryClient.setQueryData(["dash-quick-tasks", user?.id, activeOrgId], reordered);
    reordered.forEach((task, i) => {
      if (task.position !== i) updateTask.mutate({ id: task.id, position: i });
    });
  };

  // Collect all unique tags
  const allTags = Array.from(new Set(quickTasks.flatMap(t => t.tags || []))).sort();

  const filteredTasks = quickTasks.filter(t => {
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (memberFilter !== "all" && t.assigned_to !== memberFilter && t.user_id !== memberFilter) return false;
    if (tagFilter !== "all" && !(t.tags || []).includes(tagFilter)) return false;
    return true;
  });

  // CSV export
  const exportToCSV = () => {
    const headers = ["Título", "Descrição", "Status", "Prioridade", "Data de Vencimento", "Tags", "Responsável"];
    const rows = filteredTasks.map(t => {
      const assignee = orgMembers.find(m => m.user_id === t.assigned_to)?.full_name || "";
      const statusLabel = STATUS_CONFIG[t.status]?.label || t.status;
      const prioLabel = PRIORITY_CONFIG[t.priority]?.label || t.priority;
      return [
        `"${(t.title || "").replace(/"/g, '""')}"`,
        `"${(t.description || "").replace(/"/g, '""')}"`,
        statusLabel,
        prioLabel,
        t.due_date || "",
        `"${(t.tags || []).join(", ")}"`,
        `"${assignee}"`,
      ].join(",");
    });
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tarefas-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Tarefas exportadas com sucesso!");
  };

  const activeDragTask = activeDragId ? quickTasks.find(t => t.id === activeDragId) : null;

  const handleKanbanDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleKanbanDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const overId = over.id as string;
    // Check if dropped over a column droppable
    const statuses: TaskStatus[] = ["todo", "in_progress", "done"];
    if (statuses.includes(overId as TaskStatus)) {
      const task = quickTasks.find(t => t.id === taskId);
      if (task && task.status !== overId) {
        handleStatusChange(taskId, overId as TaskStatus);
      }
    } else {
      // Dropped over another card — get that card's status
      const overTask = quickTasks.find(t => t.id === overId);
      if (overTask) {
        const task = quickTasks.find(t => t.id === taskId);
        if (task && task.status !== overTask.status) {
          handleStatusChange(taskId, overTask.status);
        }
      }
    }
  };

  const todoCount = quickTasks.filter(t => t.status === "todo").length;
  const inProgressCount = quickTasks.filter(t => t.status === "in_progress").length;
  const doneCount = quickTasks.filter(t => t.status === "done").length;

  const handleStatusChange = (id: string, status: TaskStatus) => {
    updateTask.mutate({ id, status });
  };

  // Realtime: listen for tasks assigned to me
  useEffect(() => {
    if (!user?.id || !activeOrgId) return;
    const channel = supabase
      .channel("quick-tasks-assigned")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "quick_tasks",
          filter: `assigned_to=eq.${user.id}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          const oldRow = payload.old as any;
          if (oldRow.assigned_to !== newRow.assigned_to && newRow.assigned_to === user.id) {
            toast.info("Nova tarefa atribuída a você", {
              description: newRow.title,
            });
            queryClient.invalidateQueries({ queryKey: ["dash-quick-tasks"] });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "quick_tasks",
          filter: `assigned_to=eq.${user.id}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow.user_id !== user.id) {
            toast.info("Nova tarefa atribuída a você", {
              description: newRow.title,
            });
            queryClient.invalidateQueries({ queryKey: ["dash-quick-tasks"] });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, activeOrgId, queryClient]);

  return (
    <LexCard hover={false}>
      <LexCardHeader>
        <LexCardTitle className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-primary" /> Tarefas Rápidas
        </LexCardTitle>
        <div className="flex items-center gap-2">
          {/* Tag management dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" title="Gerenciar tags">
                <Palette className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Tag className="h-4 w-4 text-primary" /> Gerenciar Tags
                </DialogTitle>
              </DialogHeader>
              {activeOrgId && user && <TagManager orgId={activeOrgId} userId={user.id} />}
            </DialogContent>
          </Dialog>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">{todoCount} a fazer</span>
            <span className="text-[10px] text-warning bg-warning/10 rounded px-1.5 py-0.5">{inProgressCount} em prog.</span>
            <span className="text-[10px] text-accent bg-accent/10 rounded px-1.5 py-0.5">{doneCount} feitas</span>
          </div>
          {/* View toggle */}
          <div className="flex items-center border border-border rounded-md">
            <Button
              variant="ghost" size="icon"
              className={cn("h-7 w-7 rounded-r-none", viewMode === "list" && "bg-muted text-primary")}
              onClick={() => setViewMode("list")}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className={cn("h-7 w-7 rounded-l-none", viewMode === "kanban" && "bg-muted text-primary")}
              onClick={() => setViewMode("kanban")}
            >
              <Columns3 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </LexCardHeader>

      {/* Progress Chart */}
      {quickTasks.length > 0 && (
        <div className="mb-3">
          <TaskProgressChart todoCount={todoCount} inProgressCount={inProgressCount} doneCount={doneCount} />
        </div>
      )}

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <ToggleGroup type="single" value={priorityFilter} onValueChange={v => v && setPriorityFilter(v as PriorityFilter)} size="sm" className="justify-start flex-wrap">
          <ToggleGroupItem value="all" className="text-xs px-2.5 h-7">Todas</ToggleGroupItem>
          {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
            <ToggleGroupItem key={key} value={key} className="text-xs px-2.5 h-7 gap-1">
              <div className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* Member filter */}
        <Select value={memberFilter} onValueChange={setMemberFilter}>
          <SelectTrigger className={cn("h-7 w-auto min-w-0 text-xs gap-1 px-2 border-border", memberFilter !== "all" && "border-secondary/40 text-secondary")}>
            <UserPlus className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[80px]">
              {memberFilter === "all" ? "Todos" : orgMembers.find(m => m.user_id === memberFilter)?.full_name || "Membro"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os membros</SelectItem>
            {orgMembers.map(m => (
              <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || "Sem nome"}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className={cn("h-7 w-auto min-w-0 text-xs gap-1 px-2 border-border", tagFilter !== "all" && "border-primary/40 text-primary")}>
              <Tag className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[80px]">
                {tagFilter === "all" ? "Tags" : tagFilter}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as tags</SelectItem>
              {allTags.map(tag => (
                <SelectItem key={tag} value={tag}>
                  <div className="flex items-center gap-1.5">
                    <TagBadge tag={tag} customColor={predefinedTags.find(pt => pt.name === tag)?.color} />
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* CSV Export */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost" size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary shrink-0"
                onClick={exportToCSV}
                disabled={filteredTasks.length === 0}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Exportar CSV</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Add task form */}
      <form
        className="flex gap-2 mb-3"
        onSubmit={e => {
          e.preventDefault();
          if (!newTask.trim()) return;
          addTask.mutate({
            title: newTask.trim(),
            priority: newPriority,
            due_date: newDueDate ? format(newDueDate, "yyyy-MM-dd") : null,
            assigned_to: newAssignee === "__none__" ? null : newAssignee,
          });
          setNewTask("");
          setNewDueDate(undefined);
          setNewAssignee("__none__");
        }}
      >
        <Input placeholder="Nova tarefa..." value={newTask} onChange={e => setNewTask(e.target.value)} className="h-9 text-sm flex-1" />

        <Select value={newAssignee} onValueChange={setNewAssignee}>
          <SelectTrigger className={cn("h-9 w-9 p-0 border-border bg-transparent shadow-none flex items-center justify-center [&>svg]:hidden shrink-0", newAssignee !== "__none__" && "border-secondary/40 text-secondary")}>
            <UserPlus className="h-3.5 w-3.5" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sem atribuição</SelectItem>
            {orgMembers.map(m => (
              <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || "Sem nome"}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="icon" className={cn("h-9 w-9 shrink-0", newDueDate && "text-primary border-primary/40")}>
              <CalendarIcon className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="single" selected={newDueDate} onSelect={setNewDueDate} initialFocus className="p-3 pointer-events-auto" />
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

      {/* Metadata preview */}
      {(newDueDate || newAssignee !== "__none__") && (
        <div className="flex items-center gap-3 mb-3 -mt-1 text-[10px] text-muted-foreground">
          {newDueDate && (
            <span className="flex items-center gap-1">
              <CalendarIcon className="h-2.5 w-2.5" />
              {format(newDueDate, "dd MMM yyyy", { locale: ptBR })}
              <button type="button" className="text-destructive/60 hover:text-destructive" onClick={() => setNewDueDate(undefined)}>✕</button>
            </span>
          )}
          {newAssignee !== "__none__" && (
            <span className="flex items-center gap-1">
              <UserPlus className="h-2.5 w-2.5" />
              {orgMembers.find(m => m.user_id === newAssignee)?.full_name || "Membro"}
              <button type="button" className="text-destructive/60 hover:text-destructive" onClick={() => setNewAssignee("__none__")}>✕</button>
            </span>
          )}
        </div>
      )}

      {/* ─── LIST VIEW ─── */}
      {viewMode === "list" && (
        filteredTasks.length === 0 ? (
          <div className="py-8 text-center">
            <ListTodo className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-caption text-muted-foreground">
              {quickTasks.length === 0 ? "Nenhuma tarefa ainda. Adicione uma acima!" : "Nenhuma tarefa com essa prioridade."}
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filteredTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {filteredTasks.map(task => (
                    <SortableTask
                      key={task.id}
                      task={task}
                      members={orgMembers}
                      onToggle={(id, done) => toggleTask.mutate({ id, done })}
                      onDelete={(id) => deleteTask.mutate(id)}
                      onPriorityChange={(id, priority) => updateTask.mutate({ id, priority })}
                      onDueDateChange={(id, due_date) => updateTask.mutate({ id, due_date })}
                      onAssign={(id, assigned_to) => updateTask.mutate({ id, assigned_to })}
                      onStatusChange={handleStatusChange}
                      onUpdateTitle={(id, title) => updateTask.mutate({ id, title })}
                      onUpdateDescription={(id, description) => updateTask.mutate({ id, description })}
                      onTagsChange={(id, tags) => updateTask.mutate({ id, tags })}
                      predefinedTags={predefinedTags}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </ScrollArea>
        )
      )}

      {/* ─── KANBAN VIEW ─── */}
      {viewMode === "kanban" && (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleKanbanDragStart}
          onDragEnd={handleKanbanDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-2">
            {(["todo", "in_progress", "done"] as TaskStatus[]).map(status => (
              <DroppableKanbanColumn
                key={status}
                status={status}
                tasks={filteredTasks.filter(t => t.status === status)}
                members={orgMembers}
                onDelete={(id) => deleteTask.mutate(id)}
                onStatusChange={handleStatusChange}
                onUpdateTitle={(id, title) => updateTask.mutate({ id, title })}
                onUpdateDescription={(id, description) => updateTask.mutate({ id, description })}
              />
            ))}
          </div>
          <DragOverlay>
            {activeDragTask && (
              <DraggableKanbanCard
                task={activeDragTask}
                members={orgMembers}
                onDelete={() => {}}
                onStatusChange={() => {}}
                isDragOverlay
              />
            )}
          </DragOverlay>
        </DndContext>
      )}
    </LexCard>
  );
};

export default QuickTasksWidget;
