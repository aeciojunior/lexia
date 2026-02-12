import { useState, useMemo } from "react";
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
  Shield, Users, Scale, Search, TrendingUp, UserPlus, Trash2, ChevronLeft, ChevronRight, PenTool, FileText, CheckCircle, Clock, Download, CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { format, subMonths, isAfter, isBefore, startOfMonth, endOfMonth, eachMonthOfInterval, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { ROLE_LABELS, ROLE_BADGE_VARIANT, type OrgRole } from "@/hooks/usePermissions";

const roleMap = ROLE_LABELS;
const roleBadge = ROLE_BADGE_VARIANT;

const PAGE_SIZE = 10;

const Admin = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [roleDialog, setRoleDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newRole, setNewRole] = useState("user");
  const [sigDateFrom, setSigDateFrom] = useState<Date | undefined>(subMonths(new Date(), 6));
  const [sigDateTo, setSigDateTo] = useState<Date | undefined>(new Date());

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

  // Fetch contracts and signatures
  const { data: allContracts = [] } = useQuery({
    queryKey: ["admin-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("id, title, status, amount_cents, client_id, clients(full_name)");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin === true,
  });

  const { data: allSignatures = [] } = useQuery({
    queryKey: ["admin-all-signatures"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("contract_signatures" as any) as any).select("id, contract_id, signed_at");
      if (error) throw error;
      return (data as any[]) || [];
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

  // Filtered signatures by date range (before early returns to respect hooks rules)
  const filteredSignatures = useMemo(() => {
    return allSignatures.filter((s: any) => {
      const d = new Date(s.signed_at);
      if (sigDateFrom && isBefore(d, startOfDay(sigDateFrom))) return false;
      if (sigDateTo && isAfter(d, endOfMonth(sigDateTo))) return false;
      return true;
    });
  }, [allSignatures, sigDateFrom, sigDateTo]);

  const chartData = useMemo(() => {
    const from = sigDateFrom || subMonths(new Date(), 6);
    const to = sigDateTo || new Date();
    const months = eachMonthOfInterval({ start: startOfMonth(from), end: endOfMonth(to) });
    return months.map((month) => {
      const monthEnd = endOfMonth(month);
      const count = allSignatures.filter((s: any) => {
        const d = new Date(s.signed_at);
        return d >= month && d <= monthEnd;
      }).length;
      return { month: format(month, "MMM yy", { locale: ptBR }), assinaturas: count };
    });
  }, [allSignatures, sigDateFrom, sigDateTo]);

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

  const signedContractIds = new Set(allSignatures.map((s: any) => s.contract_id));
  const filteredSignedIds = new Set(filteredSignatures.map((s: any) => s.contract_id));
  const filteredSignedContracts = allContracts.filter((c: any) => filteredSignedIds.has(c.id));
  const filteredPendingContracts = allContracts.filter((c: any) => !signedContractIds.has(c.id) && c.status === "active");
  const filteredSignedPercent = allContracts.length > 0 ? Math.round((filteredSignedContracts.length / allContracts.length) * 100) : 0;

  // CSV export
  const exportSignaturesCsv = () => {
    const rows = filteredSignatures.map((sig: any) => {
      const contract = allContracts.find((c: any) => c.id === sig.contract_id);
      return {
        contrato: contract?.title || "—",
        cliente: (contract as any)?.clients?.full_name || "—",
        assinado_em: new Date(sig.signed_at).toLocaleString("pt-BR"),
      };
    });
    const header = "Contrato,Cliente,Assinado Em\n";
    const csv = header + rows.map((r) => `"${r.contrato}","${r.cliente}","${r.assinado_em}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `assinaturas_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

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

      {/* Contract Signatures Dashboard */}
      {allContracts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <LexCard hover={false}>
            <LexCardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
                <LexCardTitle className="flex items-center gap-2"><PenTool className="h-5 w-5 text-primary" /> Assinaturas de Contratos</LexCardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Date From */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("h-9 rounded-lg text-xs gap-1.5", !sigDateFrom && "text-muted-foreground")}>
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {sigDateFrom ? format(sigDateFrom, "dd/MM/yy") : "De"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar mode="single" selected={sigDateFrom} onSelect={setSigDateFrom} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  {/* Date To */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("h-9 rounded-lg text-xs gap-1.5", !sigDateTo && "text-muted-foreground")}>
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {sigDateTo ? format(sigDateTo, "dd/MM/yy") : "Até"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar mode="single" selected={sigDateTo} onSelect={setSigDateTo} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs gap-1.5" onClick={exportSignaturesCsv} disabled={filteredSignatures.length === 0}>
                    <Download className="h-3.5 w-3.5" /> CSV
                  </Button>
                </div>
              </div>
            </LexCardHeader>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
                <FileText className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-display-sm">{allContracts.length}</p>
                <p className="text-caption text-muted-foreground">Total</p>
              </div>
              <div className="rounded-xl border border-success/20 bg-success/5 p-4 text-center">
                <CheckCircle className="h-5 w-5 text-success mx-auto mb-2" />
                <p className="text-display-sm text-success">{filteredSignedContracts.length}</p>
                <p className="text-caption text-muted-foreground">Assinados</p>
              </div>
              <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 text-center">
                <Clock className="h-5 w-5 text-warning mx-auto mb-2" />
                <p className="text-display-sm text-warning">{filteredPendingContracts.length}</p>
                <p className="text-caption text-muted-foreground">Pendentes</p>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
                <TrendingUp className="h-5 w-5 text-primary mx-auto mb-2" />
                <p className="text-display-sm text-primary">{filteredSignedPercent}%</p>
                <p className="text-caption text-muted-foreground">Taxa de Assinatura</p>
              </div>
            </div>

            {/* Signatures Line Chart */}
            {chartData.length > 1 && (
              <div className="mb-6">
                <p className="text-overline text-muted-foreground mb-3">Evolução de Assinaturas</p>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: 12 }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Line type="monotone" dataKey="assinaturas" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))" }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Recent signatures list */}
            {filteredSignatures.length > 0 && (
              <div>
                <p className="text-overline text-muted-foreground mb-3">Últimas Assinaturas</p>
                <div className="space-y-2">
                  {filteredSignatures.slice(0, 5).map((sig: any) => {
                    const contract = allContracts.find((c: any) => c.id === sig.contract_id);
                    return (
                      <div key={sig.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/40">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
                            <CheckCircle className="h-4 w-4 text-success" />
                          </div>
                          <div>
                            <p className="text-body-sm font-medium">{contract?.title || "Contrato"}</p>
                            <p className="text-caption text-muted-foreground">{(contract as any)?.clients?.full_name || "—"}</p>
                          </div>
                        </div>
                        <p className="text-caption text-muted-foreground">
                          {new Date(sig.signed_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </LexCard>
        </motion.div>
      )}

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
                  {(Object.entries(roleMap) as [OrgRole, string][])
                    .filter(([k]) => k !== "owner") // Cannot assign owner role via UI
                    .map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
