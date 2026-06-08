import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { LexPageHeader } from "@/components/lexia/LexPageHeader";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2, Users, Mail, Trash2, UserPlus, Shield, Clock, CheckCircle, XCircle, AlertTriangle, UserX, UserCheck, ArrowRightLeft, FileText, Settings, Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import { OrgGeneralTab } from "@/components/organization/OrgGeneralTab";
import { OrgFiscalTab } from "@/components/organization/OrgFiscalTab";
import { OrgPreferencesTab } from "@/components/organization/OrgPreferencesTab";
import { OrgMaintenanceTab } from "@/components/organization/OrgMaintenanceTab";

const roleMap: Record<string, string> = { owner: "Proprietário", admin: "Administrador", user: "Usuário", intern: "Estagiário", client: "Cliente" };
const roleBadgeVariant: Record<string, string> = { owner: "destructive", admin: "warning", user: "default", intern: "info", client: "outline" };

const actionLabels: Record<string, string> = {
  invite_sent: "Convite enviado",
  invite_accepted: "Convite aceito",
  invite_revoked: "Convite revogado",
  member_removed: "Membro removido",
  user_removed: "Membro removido",
  role_updated: "Papel alterado",
  role_changed: "Papel alterado",
  user_disabled: "Usuário desativado",
  user_enabled: "Usuário reativado",
  organization_updated: "Organização atualizada",
  organization_fiscal_updated: "Dados fiscais atualizados",
  organization_logo_updated: "Logo atualizado",
  organization_preferences_updated: "Preferências atualizadas",
  maintenance_mode_enabled: "Manutenção ativada",
  maintenance_mode_disabled: "Manutenção desativada",
  change_active_organization: "Org. alterada",
  organization_deleted: "Organização excluída",
};

const Organization = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isTrial, trialDaysLeft } = usePlanLimits();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [roleDialog, setRoleDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [newRole, setNewRole] = useState("user");
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");

  const { data: org, isLoading: loadingOrg } = useQuery({
    queryKey: ["org-details", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("*").eq("id", activeOrgId!).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!activeOrgId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["org-members", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_organizations" as any).select("*, profiles:user_id(full_name, phone, avatar_url)").eq("organization_id", activeOrgId!);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId,
  });

  const currentUserRole = members.find((m: any) => m.user_id === user?.id)?.role || "user";
  const isOwnerOrAdmin = ["owner", "admin"].includes(currentUserRole);
  const isOwner = currentUserRole === "owner";

  const { data: invites = [] } = useQuery({
    queryKey: ["org-invites", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("organization_invites" as any).select("*").eq("organization_id", activeOrgId!).eq("status", "pending").order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId && isOwnerOrAdmin,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["org-audit-logs", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_logs" as any).select("*").eq("organization_id", activeOrgId!).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId && isOwnerOrAdmin,
  });

  // Mutations
  const sendInviteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("org-invites", { body: { action: "send-invite", organization_id: activeOrgId, email: inviteEmail, role: inviteRole } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["org-invites"] }); setInviteDialogOpen(false); setInviteEmail(""); setInviteRole("user"); toast.success("Convite enviado!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteInviteMutation = useMutation({
    mutationFn: async (invite: any) => {
      const { data, error } = await supabase.functions.invoke("org-invites", { body: { action: "revoke-invite", invite_id: invite.id, organization_id: activeOrgId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["org-invites"] }); toast.success("Convite revogado!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberUserId, role }: { memberUserId: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke("manage-member", { body: { action: "change-role", organization_id: activeOrgId, member_user_id: memberUserId, new_role: role } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["org-members"] }); setRoleDialog(false); toast.success("Papel atualizado!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const disableMemberMutation = useMutation({
    mutationFn: async (id: string) => { const { data, error } = await supabase.functions.invoke("manage-member", { body: { action: "disable-member", organization_id: activeOrgId, member_user_id: id } }); if (error) throw error; if (data?.error) throw new Error(data.error); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["org-members"] }); toast.success("Usuário desativado!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const enableMemberMutation = useMutation({
    mutationFn: async (id: string) => { const { data, error } = await supabase.functions.invoke("manage-member", { body: { action: "enable-member", organization_id: activeOrgId, member_user_id: id } }); if (error) throw error; if (data?.error) throw new Error(data.error); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["org-members"] }); toast.success("Usuário reativado!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (id: string) => { const { data, error } = await supabase.functions.invoke("org-invites", { body: { action: "remove-member", organization_id: activeOrgId, member_user_id: id } }); if (error) throw error; if (data?.error) throw new Error(data.error); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["org-members"] }); setRemoveDialogOpen(false); setMemberToRemove(null); toast.success("Membro removido!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteOrgMutation = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.functions.invoke("manage-member", { body: { action: "delete-organization", organization_id: activeOrgId, confirm_name: deleteConfirmName } }); if (error) throw error; if (data?.error) throw new Error(data.error); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["user-organizations"] }); setDeleteDialogOpen(false); toast.success("Organização excluída."); navigate("/no-organization"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!activeOrgId) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <LexCard hover={false} className="max-w-md text-center">
          <Building2 className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-display-sm mb-2">Sem organização ativa</h2>
          <p className="text-body-sm text-muted-foreground">Configure uma organização para continuar.</p>
        </LexCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <LexPageHeader
        overline="Configurações"
        title="Organização"
        description="Gerencie dados, membros, preferências e manutenção"
      />

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="general" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> Geral</TabsTrigger>
          <TabsTrigger value="fiscal" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Fiscal</TabsTrigger>
          <TabsTrigger value="members" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Membros</TabsTrigger>
          <TabsTrigger value="preferences" className="gap-1.5"><Settings className="h-3.5 w-3.5" /> Preferências</TabsTrigger>
          {isOwnerOrAdmin && <TabsTrigger value="maintenance" className="gap-1.5"><Wrench className="h-3.5 w-3.5" /> Manutenção</TabsTrigger>}
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <OrgGeneralTab org={org} activeOrgId={activeOrgId} isOwnerOrAdmin={isOwnerOrAdmin} currentUserRole={currentUserRole} isTrial={isTrial} trialDaysLeft={trialDaysLeft} />
          {/* Owner actions */}
          {isOwner && (
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setTransferDialogOpen(true)}>
                <ArrowRightLeft className="h-4 w-4" /> Transferir Propriedade
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4" /> Excluir Organização
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Fiscal Tab */}
        <TabsContent value="fiscal">
          <OrgFiscalTab org={org} activeOrgId={activeOrgId} isOwner={isOwner} />
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-6">
          <LexCard hover={false}>
            <LexCardHeader>
              <LexCardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Membros ({members.length})</LexCardTitle>
              {isOwnerOrAdmin && (
                <Button variant="outline" size="sm" onClick={() => setInviteDialogOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Convidar
                </Button>
              )}
            </LexCardHeader>
            <div className="space-y-2">
              {members.map((m: any) => {
                const profile = m.profiles;
                const name = profile?.full_name || "Sem nome";
                const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                const isCurrentUser = m.user_id === user?.id;
                const isDisabled = m.status === "disabled";
                const canManage = isOwnerOrAdmin && !isCurrentUser && m.role !== "owner" && !(currentUserRole === "admin" && m.role === "admin");

                return (
                  <div key={m.id} className={`flex items-center justify-between p-3 rounded-xl transition-colors group ${isDisabled ? "bg-muted/10 opacity-60" : "bg-muted/30 hover:bg-muted/50"}`}>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-body-sm font-medium">
                          {name} {isCurrentUser && <span className="text-caption text-muted-foreground">(você)</span>}
                          {isDisabled && <span className="text-caption text-destructive ml-1">(desativado)</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <LexBadge variant={roleBadgeVariant[m.role] as any}>{roleMap[m.role] || m.role}</LexBadge>
                      {canManage && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isDisabled ? (
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-success" onClick={() => enableMemberMutation.mutate(m.user_id)}>
                              <UserCheck className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedMember(m); setNewRole(m.role); setRoleDialog(true); }}>
                                <Shield className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-warning" onClick={() => disableMemberMutation.mutate(m.user_id)}>
                                <UserX className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => { setMemberToRemove(m); setRemoveDialogOpen(true); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </LexCard>

          {/* Pending Invites */}
          {isOwnerOrAdmin && invites.length > 0 && (
            <LexCard hover={false}>
              <LexCardHeader>
                <LexCardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-warning" /> Convites Pendentes ({invites.length})</LexCardTitle>
              </LexCardHeader>
              <div className="space-y-2">
                {invites.map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 group">
                    <div>
                      <p className="text-body-sm font-medium">{inv.email}</p>
                      <p className="text-caption text-muted-foreground">
                        Papel: {roleMap[inv.role] || inv.role} • Expira em {new Date(inv.expires_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <LexBadge variant="warning"><Clock className="h-3 w-3" /> Pendente</LexBadge>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteInviteMutation.mutate(inv)}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </LexCard>
          )}

          {/* Audit Logs */}
          {isOwnerOrAdmin && auditLogs.length > 0 && (
            <LexCard hover={false}>
              <LexCardHeader>
                <LexCardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-secondary" /> Logs de Auditoria</LexCardTitle>
              </LexCardHeader>
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {auditLogs.map((log: any) => (
                  <div key={log.id} className="flex items-center gap-3 p-2.5 rounded-lg text-caption hover:bg-muted/30 transition-colors">
                    <CheckCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{actionLabels[log.action] || log.action}</span>
                      {log.metadata?.email && <span className="text-muted-foreground"> — {log.metadata.email}</span>}
                    </div>
                    <span className="text-muted-foreground shrink-0">
                      {new Date(log.created_at).toLocaleDateString("pt-BR")} {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            </LexCard>
          )}
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <OrgPreferencesTab activeOrgId={activeOrgId} isOwnerOrAdmin={isOwnerOrAdmin} />
        </TabsContent>

        {/* Maintenance Tab */}
        {isOwnerOrAdmin && (
          <TabsContent value="maintenance">
            <OrgMaintenanceTab activeOrgId={activeOrgId} isOwner={isOwner} />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Convidar Membro</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Email</label>
              <Input className="bg-muted border-border rounded-xl" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colega@escritorio.com" />
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Papel</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currentUserRole === "owner" && <SelectItem value="admin">Administrador</SelectItem>}
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="intern">Estagiário</SelectItem>
                  <SelectItem value="client">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => sendInviteMutation.mutate()} disabled={!inviteEmail || sendInviteMutation.isPending}>
                {sendInviteMutation.isPending ? "Enviando..." : "Enviar Convite"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={roleDialog} onOpenChange={setRoleDialog}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Alterar Papel</DialogTitle></DialogHeader>
          {selectedMember && (
            <div className="space-y-4">
              <p className="text-body-sm">Alterar o papel de <span className="font-semibold">{selectedMember.profiles?.full_name || "membro"}</span>:</p>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currentUserRole === "owner" && <SelectItem value="admin">Administrador</SelectItem>}
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="intern">Estagiário</SelectItem>
                  <SelectItem value="client">Cliente</SelectItem>
                </SelectContent>
              </Select>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRoleDialog(false)}>Cancelar</Button>
                <Button onClick={() => updateRoleMutation.mutate({ memberUserId: selectedMember.user_id, role: newRole })} disabled={updateRoleMutation.isPending}>
                  {updateRoleMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={(o) => { setRemoveDialogOpen(o); if (!o) setMemberToRemove(null); }}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Remover Membro</DialogTitle></DialogHeader>
          {memberToRemove && (
            <div className="space-y-4">
              <p className="text-body-sm">Remover <span className="font-semibold">{memberToRemove.profiles?.full_name || "membro"}</span>?</p>
              <p className="text-caption text-muted-foreground">O membro perderá acesso imediato. Dados criados serão mantidos.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRemoveDialogOpen(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={() => removeMemberMutation.mutate(memberToRemove.user_id)} disabled={removeMemberMutation.isPending}>
                  {removeMemberMutation.isPending ? "Removendo..." : "Remover"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Org Dialog — RF-022 */}
      <Dialog open={deleteDialogOpen} onOpenChange={(o) => { setDeleteDialogOpen(o); if (!o) { setDeleteConfirmName(""); setDeleteStep(1); } }}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-display-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Excluir Organização
            </DialogTitle>
            <DialogDescription className="text-body-sm text-muted-foreground">
              Esta ação é <strong>permanente</strong> e <strong>não poderá ser desfeita</strong>.
            </DialogDescription>
          </DialogHeader>

          {deleteStep === 1 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 space-y-3">
                <p className="text-body-sm font-semibold text-destructive">Impactos da exclusão:</p>
                <ul className="space-y-2 text-caption text-destructive/90">
                  <li className="flex items-start gap-2"><XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Todos os dados cadastrais da organização serão removidos permanentemente</li>
                  <li className="flex items-start gap-2"><XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <strong>{members.length}</strong> membro(s) perderão acesso imediato</li>
                  <li className="flex items-start gap-2"><XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Processos, documentos, contratos e integrações serão apagados</li>
                  <li className="flex items-start gap-2"><XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Automações, agentes de IA e configurações serão removidos</li>
                  <li className="flex items-start gap-2"><XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Logs históricos de auditoria podem ser preservados para conformidade</li>
                </ul>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={() => setDeleteStep(2)}>
                  Entendo os riscos, continuar
                </Button>
              </DialogFooter>
            </div>
          )}

          {deleteStep === 2 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-body-sm text-muted-foreground">
                  Você está prestes a excluir a organização:
                </p>
                <p className="text-body-sm font-bold mt-1">{org?.name}</p>
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">
                  Digite <strong className="text-foreground">"{org?.name}"</strong> para confirmar a exclusão
                </label>
                <Input
                  className="bg-muted border-border rounded-xl"
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  placeholder="Digite o nome da organização"
                  autoComplete="off"
                />
                {deleteConfirmName.length > 0 && deleteConfirmName !== org?.name && (
                  <p className="text-caption text-destructive mt-1">O nome digitado não corresponde ao nome da organização.</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setDeleteStep(1); setDeleteConfirmName(""); }}>Voltar</Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteOrgMutation.mutate()}
                  disabled={deleteOrgMutation.isPending || deleteConfirmName !== org?.name}
                >
                  {deleteOrgMutation.isPending ? "Excluindo..." : "Confirmar Exclusão"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer Ownership Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-display-sm">Transferir Propriedade</DialogTitle>
            <DialogDescription className="text-body-sm text-muted-foreground">
              Selecione o novo proprietário. Você será rebaixado para Admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={transferTargetId} onValueChange={setTransferTargetId}>
              <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue placeholder="Selecione o novo Owner" /></SelectTrigger>
              <SelectContent>
                {members.filter((m: any) => m.user_id !== user?.id && m.role !== "owner" && m.status !== "disabled").map((m: any) => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.profiles?.full_name || m.user_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
              <p className="text-caption text-warning font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Esta ação não pode ser revertida facilmente.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>Cancelar</Button>
              <Button disabled={!transferTargetId}>Confirmar Transferência</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Organization;
