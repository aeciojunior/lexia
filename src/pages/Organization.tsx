import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Building2, Users, Mail, Save, Trash2, UserPlus, Shield, Clock, CheckCircle, XCircle, AlertTriangle, Camera, Loader2, UserX, UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useRef } from "react";

const roleMap: Record<string, string> = { owner: "Proprietário", admin: "Administrador", user: "Usuário", intern: "Estagiário", client: "Cliente" };
const roleBadgeVariant: Record<string, string> = { owner: "destructive", admin: "warning", user: "default", intern: "info", client: "outline" };

const Organization = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();

  const [orgName, setOrgName] = useState("");
  const [orgTaxId, setOrgTaxId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [roleDialog, setRoleDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [newRole, setNewRole] = useState("user");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<any>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Fetch org details
  const { data: org, isLoading: loadingOrg } = useQuery({
    queryKey: ["org-details", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", activeOrgId!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!activeOrgId,
  });

  // Fetch members
  const { data: members = [] } = useQuery({
    queryKey: ["org-members", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_organizations" as any)
        .select("*, profiles:user_id(full_name, phone, avatar_url)")
        .eq("organization_id", activeOrgId!);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId,
  });

  // Current user's role in this org
  const currentUserRole = members.find((m: any) => m.user_id === user?.id)?.role || "user";
  const isOwnerOrAdmin = ["owner", "admin"].includes(currentUserRole);

  // Fetch invites
  const { data: invites = [] } = useQuery({
    queryKey: ["org-invites", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_invites" as any)
        .select("*")
        .eq("organization_id", activeOrgId!)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId && isOwnerOrAdmin,
  });

  // Fetch audit logs
  const { data: auditLogs = [] } = useQuery({
    queryKey: ["org-audit-logs", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs" as any)
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId && isOwnerOrAdmin,
  });

  // Update org name/taxId
  const updateOrgMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("organizations")
        .update({ name: orgName, tax_id: orgTaxId || null } as any)
        .eq("id", activeOrgId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-details"] });
      queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
      toast.success("Organização atualizada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Send invite
  const sendInviteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("org-invites", {
        body: { action: "send-invite", organization_id: activeOrgId, email: inviteEmail, role: inviteRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-invites"] });
      queryClient.invalidateQueries({ queryKey: ["org-audit-logs"] });
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("user");
      toast.success("Convite enviado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Revoke invite
  const deleteInviteMutation = useMutation({
    mutationFn: async (invite: any) => {
      const { data, error } = await supabase.functions.invoke("org-invites", {
        body: { action: "revoke-invite", invite_id: invite.id, organization_id: activeOrgId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-invites"] });
      queryClient.invalidateQueries({ queryKey: ["org-audit-logs"] });
      toast.success("Convite revogado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Update member role via edge function (RF-011)
  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberUserId, role }: { memberUserId: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke("manage-member", {
        body: { action: "change-role", organization_id: activeOrgId, member_user_id: memberUserId, new_role: role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
      queryClient.invalidateQueries({ queryKey: ["org-audit-logs"] });
      setRoleDialog(false);
      toast.success("Papel atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Disable member (RF-012)
  const disableMemberMutation = useMutation({
    mutationFn: async (memberUserId: string) => {
      const { data, error } = await supabase.functions.invoke("manage-member", {
        body: { action: "disable-member", organization_id: activeOrgId, member_user_id: memberUserId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
      queryClient.invalidateQueries({ queryKey: ["org-audit-logs"] });
      toast.success("Usuário desativado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Enable member (RF-012)
  const enableMemberMutation = useMutation({
    mutationFn: async (memberUserId: string) => {
      const { data, error } = await supabase.functions.invoke("manage-member", {
        body: { action: "enable-member", organization_id: activeOrgId, member_user_id: memberUserId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
      queryClient.invalidateQueries({ queryKey: ["org-audit-logs"] });
      toast.success("Usuário reativado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Remove member via edge function
  const removeMemberMutation = useMutation({
    mutationFn: async (memberUserId: string) => {
      const { data, error } = await supabase.functions.invoke("org-invites", {
        body: { action: "remove-member", organization_id: activeOrgId, member_user_id: memberUserId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
      queryClient.invalidateQueries({ queryKey: ["org-invites"] });
      queryClient.invalidateQueries({ queryKey: ["org-audit-logs"] });
      setRemoveDialogOpen(false);
      setMemberToRemove(null);
      toast.success("Membro removido com sucesso!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleLogoRemove = async () => {
    if (!activeOrgId) return;
    setUploadingLogo(true);
    try {
      const { data: files } = await supabase.storage.from("org-logos").list(activeOrgId);
      if (files && files.length > 0) {
        await supabase.storage.from("org-logos").remove(files.map(f => `${activeOrgId}/${f.name}`));
      }
      const { error } = await supabase.from("organizations").update({ logo_url: null } as any).eq("id", activeOrgId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["org-details"] });
      queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
      toast.success("Logo removido!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeOrgId) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Máximo 2MB"); return; }

    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${activeOrgId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage.from("org-logos").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("org-logos").getPublicUrl(path);
      const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.from("organizations").update({ logo_url: logoUrl } as any).eq("id", activeOrgId);
      if (updateError) throw updateError;
      queryClient.invalidateQueries({ queryKey: ["org-details"] });
      queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
      toast.success("Logo atualizado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar logo");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  // Set orgName when org loads
  if (org && !orgName && !loadingOrg) {
    setOrgName(org.name || "");
    setOrgTaxId(org.tax_id || "");
  }

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
    password_reset_request: "Recuperação de senha",
    password_reset_success: "Senha redefinida",
    profile_updated: "Perfil atualizado",
    change_active_organization: "Org. alterada",
  };

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
    <div className="p-6 lg:p-8 space-y-8 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-overline text-primary mb-1">Configurações</p>
        <h1 className="text-display-lg">Organização</h1>
        <p className="text-body-sm text-muted-foreground mt-1">Gerencie sua organização, membros e convites</p>
      </motion.div>

      {/* Org Info */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <LexCard hover={false}>
          <LexCardHeader>
            <LexCardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Dados da Organização</LexCardTitle>
          </LexCardHeader>
          <div className="space-y-4">
            {/* Logo upload */}
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Avatar className="h-16 w-16">
                  {org?.logo_url && <AvatarImage src={org.logo_url} alt={org?.name} />}
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                    {(org?.name || "O").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isOwnerOrAdmin && (
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {uploadingLogo ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
                  </button>
                )}
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
              <div>
                <p className="text-body-sm font-medium">{org?.name || "Organização"}</p>
                <p className="text-caption text-muted-foreground">
                  {isOwnerOrAdmin ? "Clique no avatar para alterar o logo" : "Logo da organização"}
                </p>
                {isOwnerOrAdmin && org?.logo_url && (
                  <button
                    onClick={handleLogoRemove}
                    disabled={uploadingLogo}
                    className="text-caption text-destructive hover:underline mt-1"
                  >
                    Remover logo
                  </button>
                )}
              </div>
            </div>

            <Separator />

            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Nome</label>
              <Input className="bg-muted border-border rounded-xl max-w-md" value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={!isOwnerOrAdmin} />
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">CNPJ</label>
              <Input className="bg-muted border-border rounded-xl max-w-md" value={orgTaxId} onChange={(e) => setOrgTaxId(e.target.value)} placeholder="00.000.000/0000-00" disabled={!isOwnerOrAdmin} />
            </div>
            {isOwnerOrAdmin && (
              <Button onClick={() => updateOrgMutation.mutate()} disabled={updateOrgMutation.isPending}>
                <Save className="h-4 w-4" /> {updateOrgMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            )}
          </div>
        </LexCard>
      </motion.div>

      {/* Members */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
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
                      <p className="text-caption text-muted-foreground">{profile?.phone || ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <LexBadge variant={roleBadgeVariant[m.role] as any}>{roleMap[m.role] || m.role}</LexBadge>
                    {canManage && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isDisabled ? (
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-success" onClick={() => enableMemberMutation.mutate(m.user_id)} disabled={enableMemberMutation.isPending}>
                            <UserCheck className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedMember(m); setNewRole(m.role); setRoleDialog(true); }} title="Alterar papel">
                              <Shield className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-warning" onClick={() => disableMemberMutation.mutate(m.user_id)} disabled={disableMemberMutation.isPending} title="Desativar">
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => { setMemberToRemove(m); setRemoveDialogOpen(true); }} title="Remover">
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
      </motion.div>

      {/* Pending Invites */}
      {isOwnerOrAdmin && invites.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
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
        </motion.div>
      )}

      {/* Audit Logs */}
      {isOwnerOrAdmin && auditLogs.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
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
        </motion.div>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Convidar Membro</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Email</label>
              <Input className="bg-muted border-border rounded-xl" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colega@escritorio.com" required />
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
              <p className="text-caption text-muted-foreground">
                {currentUserRole === "admin" ? "Admins não podem convidar Administradores ou Proprietários." : "Proprietários podem convidar qualquer papel exceto Proprietário."}
              </p>
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
              <p className="text-caption text-muted-foreground">
                {currentUserRole === "admin" ? "Admins só podem alterar para Usuário, Estagiário ou Cliente." : "Owners podem alterar para qualquer papel exceto Proprietário."}
              </p>
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

      {/* Remove Member Confirmation Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={(open) => { setRemoveDialogOpen(open); if (!open) setMemberToRemove(null); }}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Remover Membro</DialogTitle></DialogHeader>
          {memberToRemove && (
            <div className="space-y-4">
              <p className="text-body-sm">
                Tem certeza que deseja remover <span className="font-semibold">{memberToRemove.profiles?.full_name || "este membro"}</span> ({roleMap[memberToRemove.role] || memberToRemove.role}) da organização?
              </p>
              <p className="text-caption text-muted-foreground">
                O membro perderá acesso imediato a todos os recursos da organização. Dados criados por ele serão mantidos.
              </p>
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
    </div>
  );
};

export default Organization;
