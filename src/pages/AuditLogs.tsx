import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Shield, User, Bot, Zap } from "lucide-react";
import { format } from "date-fns";

const ACTION_CATEGORIES: Record<string, { label: string; icon: any; color: string }> = {
  login: { label: "Login", icon: User, color: "default" },
  logout: { label: "Logout", icon: User, color: "secondary" },
  user_registered: { label: "Registro", icon: User, color: "default" },
  workflow_created: { label: "Workflow", icon: Zap, color: "default" },
  workflow_executed: { label: "Workflow", icon: Zap, color: "secondary" },
  ticket_created: { label: "Ticket", icon: Shield, color: "default" },
  wiki_article_created: { label: "Wiki", icon: Shield, color: "default" },
  integration_connected: { label: "Integração", icon: Zap, color: "default" },
  prediction_generated: { label: "IA", icon: Bot, color: "secondary" },
  sla_created: { label: "SLA", icon: Shield, color: "default" },
  sla_violated: { label: "SLA", icon: Shield, color: "destructive" },
  risk_created: { label: "Risco", icon: Shield, color: "default" },
};

const RESOURCE_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "auth", label: "Autenticação" },
  { value: "process", label: "Processos" },
  { value: "document", label: "Documentos" },
  { value: "task", label: "Tarefas" },
  { value: "workflow", label: "Workflows" },
  { value: "ticket", label: "Tickets" },
  { value: "sla", label: "SLA" },
  { value: "risk", label: "Riscos" },
  { value: "integration", label: "Integrações" },
];

const AuditLogs = () => {
  const { activeOrgId } = useOrganization();
  const [search, setSearch] = useState("");
  const [resourceFilter, setResourceFilter] = useState("all");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs", activeOrgId, search, resourceFilter],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (search) query = query.ilike("action", `%${search}%`);
      if (resourceFilter !== "all") query = query.eq("resource_type", resourceFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const getActionInfo = (action: string) => ACTION_CATEGORIES[action] || { label: action, icon: Shield, color: "outline" };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Auditoria Avançada</h1>
        <p className="text-muted-foreground">Trilha completa de ações e eventos do sistema</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por ação..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={resourceFilter} onValueChange={setResourceFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RESOURCE_FILTERS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ação</TableHead>
              <TableHead>Recurso</TableHead>
              <TableHead>Detalhes</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={4}>Carregando...</TableCell></TableRow>}
            {logs?.map((log: any) => {
              const info = getActionInfo(log.action);
              const Icon = info.icon;
              return (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <Badge variant={info.color as any}>{log.action}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {log.resource_type && <Badge variant="outline">{log.resource_type}</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {log.metadata ? JSON.stringify(log.metadata).slice(0, 80) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss")}</TableCell>
                </TableRow>
              );
            })}
            {!isLoading && logs?.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum log encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default AuditLogs;
