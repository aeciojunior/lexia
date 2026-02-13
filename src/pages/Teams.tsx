import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { LexCard } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { UsersRound, Plus, Pencil, Trash2, UserPlus, UserMinus, Crown, Tag } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";

const legalAreas = ["Cível", "Criminal", "Trabalhista", "Tributário", "Administrativo", "Ambiental", "Empresarial", "Família", "Outro"];

const Teams = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null);
  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [form, setForm] = useState({ name: "", description: "", legal_area: "", leader_id: "", tags: [] as string[] });
  const [tagInput, setTagInput] = useState("");

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["teams", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members" as any)
        .select("*");
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: orgMembers = [] } = useQuery({
    queryKey: ["org-members", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_organizations")
        .select("user_id, role")
        .eq("organization_id", activeOrgId!)
        .neq("role", "client");
      if (!data) return [];
      const userIds = data.map(d => d.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      return data.map(d => ({
        ...d,
        full_name: profiles?.find(p => p.user_id === d.user_id)?.full_name || d.user_id.slice(0, 8),
      }));
    },
    enabled: !!activeOrgId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome obrigatório");
      const payload = {
        name: form.name,
        description: form.description || null,
        legal_area: form.legal_area || null,
        leader_id: form.leader_id || null,
        organization_id: activeOrgId!,
        tags: form.tags,
      };
      if (editId) {
        const { error } = await (supabase.from("teams" as any) as any).update(payload).eq("id", editId);
        if (error) throw error;
        await supabase.from("audit_logs").insert({ action: "team_updated", user_id: user!.id, resource_type: "team", resource_id: editId, organization_id: activeOrgId } as any);
      } else {
        const { data, error } = await (supabase.from("teams" as any) as any).insert(payload).select("id").single();
        if (error) throw error;
        await supabase.from("audit_logs").insert({ action: "team_created", user_id: user!.id, resource_type: "team", resource_id: data.id, organization_id: activeOrgId } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setDialogOpen(false);
      resetForm();
      toast.success(editId ? "Time atualizado!" : "Time criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("teams" as any) as any).delete().eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "team_deleted", user_id: user!.id, resource_type: "team", resource_id: id, organization_id: activeOrgId } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setDeleteId(null);
      toast.success("Time excluído!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addMemberMutation = useMutation({
    mutationFn: async () => {
      if (!addMemberTeamId || !newMemberUserId) throw new Error("Selecione um membro");
      const { error } = await (supabase.from("team_members" as any) as any).insert({
        team_id: addMemberTeamId, user_id: newMemberUserId, organization_id: activeOrgId!,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "team_member_added", user_id: user!.id, resource_type: "team", resource_id: addMemberTeamId, organization_id: activeOrgId, metadata: { member_id: newMemberUserId } } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setAddMemberTeamId(null);
      setNewMemberUserId("");
      toast.success("Membro adicionado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ memberId, teamId }: { memberId: string; teamId: string }) => {
      const { error } = await (supabase.from("team_members" as any) as any).delete().eq("id", memberId);
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "team_member_removed", user_id: user!.id, resource_type: "team", resource_id: teamId, organization_id: activeOrgId } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Membro removido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => { setForm({ name: "", description: "", legal_area: "", leader_id: "", tags: [] }); setEditId(null); setTagInput(""); };

  const openEdit = (t: any) => {
    setForm({ name: t.name, description: t.description || "", legal_area: t.legal_area || "", leader_id: t.leader_id || "", tags: t.tags || [] });
    setEditId(t.id);
    setDialogOpen(true);
  };

  const getMemberName = (userId: string) => orgMembers.find((m: any) => m.user_id === userId)?.full_name || userId.slice(0, 8);
  const getTeamMembers = (teamId: string) => teamMembers.filter((tm: any) => tm.team_id === teamId);

  const addTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      setForm(f => ({ ...f, tags: [...f.tags, tagInput.trim()] }));
      setTagInput("");
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <UsersRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-overline text-primary mb-0.5">Organização</p>
            <h1 className="text-display-lg">Times & Departamentos</h1>
          </div>
        </div>
        <p className="text-body-sm text-muted-foreground mt-1">Estruture sua equipe em times e departamentos</p>
      </motion.div>

      <RoleGuard permissions={["MANAGE_TEAMS"]}>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />Novo Time</Button>
      </RoleGuard>

      <div className="grid gap-4">
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : teams.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum time criado</p>
        ) : (
          teams.map((t: any) => {
            const members = getTeamMembers(t.id);
            return (
              <LexCard key={t.id} className="hover:border-primary/30 transition-colors">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{t.name}</h3>
                        {t.legal_area && <LexBadge variant="outline">{t.legal_area}</LexBadge>}
                      </div>
                      {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                      {t.leader_id && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Crown className="h-3 w-3 text-warning" />Líder: {getMemberName(t.leader_id)}</p>}
                      {t.tags?.length > 0 && (
                        <div className="flex gap-1 mt-2">{t.tags.map((tag: string) => <LexBadge key={tag} variant="outline" className="text-xs">{tag}</LexBadge>)}</div>
                      )}
                    </div>
                    <RoleGuard permissions={["MANAGE_TEAMS"]}>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </RoleGuard>
                  </div>

                  {/* Members */}
                  <div className="border-t border-border pt-3 mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">{members.length} membro{members.length !== 1 ? "s" : ""}</p>
                      <RoleGuard permissions={["MANAGE_TEAMS"]}>
                        <Button variant="outline" size="sm" onClick={() => { setAddMemberTeamId(t.id); setNewMemberUserId(""); }}>
                          <UserPlus className="h-3 w-3 mr-1" />Adicionar
                        </Button>
                      </RoleGuard>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {members.map((m: any) => (
                        <div key={m.id} className="flex items-center gap-1.5 bg-muted rounded-lg px-3 py-1.5 text-sm">
                          <span>{getMemberName(m.user_id)}</span>
                          <RoleGuard permissions={["MANAGE_TEAMS"]}>
                            <button onClick={() => removeMemberMutation.mutate({ memberId: m.id, teamId: t.id })} className="text-muted-foreground hover:text-destructive ml-1">
                              <UserMinus className="h-3 w-3" />
                            </button>
                          </RoleGuard>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </LexCard>
            );
          })
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar Time" : "Novo Time"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome do time *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Textarea placeholder="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            <Select value={form.legal_area || "none"} onValueChange={v => setForm(f => ({ ...f, legal_area: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Área jurídica" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {legalAreas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.leader_id || "none"} onValueChange={v => setForm(f => ({ ...f, leader_id: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Líder do time" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem líder</SelectItem>
                {orgMembers.map((m: any) => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div>
              <div className="flex gap-2">
                <Input placeholder="Adicionar tag" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())} />
                <Button variant="outline" size="sm" onClick={addTag}><Tag className="h-4 w-4" /></Button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {form.tags.map(t => <LexBadge key={t} variant="outline" className="cursor-pointer" onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))}>{t} ×</LexBadge>)}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : editId ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={!!addMemberTeamId} onOpenChange={() => setAddMemberTeamId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Membro</DialogTitle></DialogHeader>
          <Select value={newMemberUserId || "none"} onValueChange={v => setNewMemberUserId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Selecionar membro" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Selecione...</SelectItem>
              {orgMembers.filter((m: any) => !getTeamMembers(addMemberTeamId!).some((tm: any) => tm.user_id === m.user_id)).map((m: any) => (
                <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberTeamId(null)}>Cancelar</Button>
            <Button onClick={() => addMemberMutation.mutate()} disabled={!newMemberUserId || addMemberMutation.isPending}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir time?</AlertDialogTitle>
            <AlertDialogDescription>Todos os membros serão desvinculados. Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Teams;
