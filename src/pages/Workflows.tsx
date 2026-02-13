import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { RoleGuard } from "@/components/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Play, GitBranch, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary",
  active: "default",
  inactive: "outline",
  running: "default",
  completed: "secondary",
  failed: "destructive",
};

const TRIGGER_TYPES = [
  { value: "manual", label: "Manual" },
  { value: "event", label: "Por Evento" },
  { value: "schedule", label: "Agendado" },
];

const Workflows = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("manual");

  const { data: workflows, isLoading } = useQuery({
    queryKey: ["workflows", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflows")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const { data: runs } = useQuery({
    queryKey: ["workflow-runs", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_runs")
        .select("*, workflows(name)")
        .eq("organization_id", activeOrgId!)
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const createWorkflow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("workflows").insert({
        organization_id: activeOrgId!,
        name,
        description,
        trigger_type: triggerType,
        created_by: user!.id,
      } as any);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "workflow_created",
        user_id: user!.id,
        organization_id: activeOrgId,
        resource_type: "workflow",
        metadata: { name },
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setOpen(false);
      setName("");
      setDescription("");
      toast({ title: "Workflow criado com sucesso" });
    },
  });

  const executeWorkflow = useMutation({
    mutationFn: async (workflowId: string) => {
      const { error } = await supabase.from("workflow_runs").insert({
        workflow_id: workflowId,
        organization_id: activeOrgId!,
        triggered_by: user!.id,
        status: "completed",
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      } as any);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "workflow_executed",
        user_id: user!.id,
        organization_id: activeOrgId,
        resource_type: "workflow",
        resource_id: workflowId,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-runs"] });
      toast({ title: "Workflow executado com sucesso" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workflows</h1>
          <p className="text-muted-foreground">Gerencie fluxos internos automatizados</p>
        </div>
        <RoleGuard permissions={["MANAGE_WORKFLOWS"]}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Workflow</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar Workflow</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Nome do workflow" value={name} onChange={(e) => setName(e.target.value)} />
                <Textarea placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} />
                <Select value={triggerType} onValueChange={setTriggerType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => createWorkflow.mutate()} disabled={!name}>Criar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </RoleGuard>
      </div>

      <Tabs defaultValue="workflows">
        <TabsList>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="runs">Execuções</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {isLoading && <p className="text-muted-foreground">Carregando...</p>}
            {workflows?.map((wf: any) => (
              <Card key={wf.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{wf.name}</CardTitle>
                    <Badge variant={STATUS_COLORS[wf.status] as any}>{wf.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {wf.description && <p className="text-sm text-muted-foreground">{wf.description}</p>}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <GitBranch className="h-3 w-3" />
                    <span>Trigger: {TRIGGER_TYPES.find((t) => t.value === wf.trigger_type)?.label}</span>
                    <span>v{wf.version}</span>
                  </div>
                  <RoleGuard permissions={["EXECUTE_WORKFLOWS"]}>
                    <Button size="sm" variant="outline" onClick={() => executeWorkflow.mutate(wf.id)} disabled={wf.status !== "active"}>
                      <Play className="h-3 w-3 mr-1" />Executar
                    </Button>
                  </RoleGuard>
                </CardContent>
              </Card>
            ))}
            {!isLoading && workflows?.length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-8">Nenhum workflow criado.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="runs">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs?.map((run: any) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">{run.workflows?.name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_COLORS[run.status] as any} className="gap-1">
                        {run.status === "completed" && <CheckCircle2 className="h-3 w-3" />}
                        {run.status === "failed" && <XCircle className="h-3 w-3" />}
                        {run.status === "running" && <Clock className="h-3 w-3" />}
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{format(new Date(run.started_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell className="text-sm">{run.finished_at ? format(new Date(run.finished_at), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
                  </TableRow>
                ))}
                {runs?.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhuma execução registrada.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Workflows;
