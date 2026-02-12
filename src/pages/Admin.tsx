import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Shield, Users, Scale, Search, TrendingUp, UserPlus, Trash2, ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const roleMap: Record<string, string> = { admin: "Admin", user: "Usuário", intern: "Estagiário" };
const roleBadge: Record<string, string> = { admin: "destructive", user: "default", intern: "warning" };

const PAGE_SIZE = 10;

const Admin = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [roleDialog, setRoleDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newRole, setNewRole] = useState("user");

  // Check if current user is admin
  const { data: isAdmin, isLoading: checkingAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!user,
  });

  // Fetch all profiles (admin only)
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles", search],
    queryFn: async () => {
      let q = supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (search) q = q.ilike("full_name", `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: isAdmin === true,
  });

  // Fetch all roles
  const { data: allRoles = [] } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin === true,
  });

  // Fetch all processes stats
  const { data: allProcesses = [] } = useQuery({
    queryKey: ["admin-processes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("processes").select("status, risk_level, user_id, archived");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin === true,
  });

  const getRoleForUser = (userId: string) => {
    const role = allRoles.find((r) => r.user_id === userId);
    return role?.role || "user";
  };

  // Update role
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const existing = allRoles.find((r) => r.user_id === userId);
      if (existing) {
        const { error } = await supabase.from("user_roles").update({ role: role as any }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      setRoleDialog(false);
      toast.success("Papel atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (checkingAdmin) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse-glow" />
          <span className="h-2.5 w-2.5 rounded-full bg-secondary animate-pulse-glow" style={{ animationDelay: "200ms" }} />
          <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse-glow" style={{ animationDelay: "400ms" }} />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <LexCard hover={false} className="max-w-md text-center">
          <Shield className="h-16 w-16 text-destructive/30 mx-auto mb-4" />
          <h2 className="text-display-sm mb-2">Acesso Restrito</h2>
          <p className="text-body-sm text-muted-foreground">
            Você não tem permissão para acessar o painel administrativo. 
            Contate um administrador para obter acesso.
          </p>
        </LexCard>
      </div>
    );
  }

  // Stats
  const totalUsers = profiles.length;
  const totalProcesses = allProcesses.length;
  const activeProcesses = allProcesses.filter((p) => p.status === "active" && !p.archived).length;
  const highRiskProcesses = allProcesses.filter((p) => (p.risk_level === "high" || p.risk_level === "critical") && !p.archived).length;

  const kpis = [
    { label: "Usuários", value: totalUsers, icon: Users, text: "text-primary", border: "border-primary/20", gradient: "from-primary/20 to-primary/5" },
    { label: "Processos", value: totalProcesses, icon: Scale, text: "text-secondary", border: "border-secondary/20", gradient: "from-secondary/20 to-secondary/5" },
    { label: "Ativos", value: activeProcesses, icon: TrendingUp, text: "text-success", border: "border-success/20", gradient: "from-success/20 to-success/5" },
    { label: "Alto Risco", value: highRiskProcesses, icon: Shield, text: "text-destructive", border: "border-destructive/20", gradient: "from-destructive/20 to-destructive/5" },
  ];

  const paginatedProfiles = profiles.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(profiles.length / PAGE_SIZE);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-overline text-destructive mb-1">Administração</p>
        <h1 className="text-display-lg">Painel Admin</h1>
        <p className="text-body-sm text-muted-foreground mt-1">Visão geral do escritório e gestão de usuários</p>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <div className={`rounded-xl border ${kpi.border} bg-gradient-to-br ${kpi.gradient} p-5 transition-all duration-normal hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02] cursor-default group`}>
              <div className="flex items-center justify-between mb-3">
                <kpi.icon className={`h-5 w-5 ${kpi.text} transition-transform duration-normal group-hover:scale-110`} />
                <span className="text-overline text-muted-foreground">{kpi.label}</span>
              </div>
              <p className={`text-display-lg ${kpi.text}`}>{kpi.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Users table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <LexCard hover={false}>
          <LexCardHeader>
            <LexCardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Usuários do Escritório</LexCardTitle>
          </LexCardHeader>

          <div className="mb-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-10 h-11 rounded-xl bg-muted border-border" placeholder="Buscar por nome..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
            </div>
          </div>

          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Usuário", "Papel", "Cadastro", "Ações"].map((h) => (
                    <th key={h} className="text-left py-3 text-overline text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedProfiles.map((p: any, i: number) => {
                  const role = getRoleForUser(p.user_id);
                  const initials = p.full_name ? p.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() : "U";
                  return (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors group"
                    >
                      <td className="py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{p.full_name || "Sem nome"}</p>
                            <p className="text-caption text-muted-foreground">{p.phone || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <LexBadge variant={roleBadge[role] as any}>{roleMap[role] || role}</LexBadge>
                      </td>
                      <td className="py-3.5 text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-3.5">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-normal">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-lg text-caption"
                            onClick={() => {
                              setSelectedUser(p);
                              setNewRole(role);
                              setRoleDialog(true);
                            }}
                          >
                            <UserPlus className="h-3.5 w-3.5" /> Alterar Papel
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
              <p className="text-caption text-muted-foreground">{profiles.length} usuários • Página {page + 1}/{totalPages}</p>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </LexCard>
      </motion.div>

      {/* Change Role Dialog */}
      <Dialog open={roleDialog} onOpenChange={setRoleDialog}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Alterar Papel</DialogTitle></DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <p className="text-body-sm">Alterar o papel de <span className="font-semibold">{selectedUser.full_name || "usuário"}</span>:</p>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(roleMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRoleDialog(false)}>Cancelar</Button>
                <Button onClick={() => updateRoleMutation.mutate({ userId: selectedUser.user_id, role: newRole })} disabled={updateRoleMutation.isPending}>
                  {updateRoleMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
