import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus, Timer, AlertTriangle, CheckCircle2, XCircle, BarChart3 } from "lucide-react";
import { format } from "date-fns";

const RESOURCE_TYPES = [
  { value: "ticket", label: "Ticket" },
  { value: "task", label: "Tarefa" },
  { value: "process", label: "Processo" },
  { value: "document", label: "Documento" },
  { value: "hearing", label: "Audiência" },
];

const SLA = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [resourceType, setResourceType] = useState("ticket");
  const [maxResponse, setMaxResponse] = useState("");
  const [maxResolution, setMaxResolution] = useState("");

  const { data: policies, isLoading } = useQuery({
    queryKey: ["sla-policies", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_policies")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const { data: violations } = useQuery({
    queryKey: ["sla-violations", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_violations")
        .select("*, sla_policies(name)")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const createPolicy = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sla_policies").insert({
        organization_id: activeOrgId!,
        name,
        description,
        resource_type: resourceType,
        max_response_hours: maxResponse ? parseInt(maxResponse) : null,
        max_resolution_hours: maxResolution ? parseInt(maxResolution) : null,
        created_by: user!.id,
      } as any);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "sla_created", user_id: user!.id, organization_id: activeOrgId, resource_type: "sla",
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-policies"] });
      setOpen(false);
      setName("");
      setDescription("");
      setMaxResponse("");
      setMaxResolution("");
      toast({ title: "SLA criado com sucesso" });
    },
  });

  const togglePolicy = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("sla_policies").update({ is_active: active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sla-policies"] }),
  });

  const totalViolations = violations?.length || 0;
  const activePolicies = policies?.filter((p: any) => p.is_active).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SLA & Performance</h1>
          <p className="text-muted-foreground">Monitore acordos de nível de serviço</p>
        </div>
        <RoleGuard permissions={["MANAGE_SLA"]}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Política SLA</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar Política SLA</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
                <Textarea placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} />
                <Select value={resourceType} onValueChange={setResourceType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESOURCE_TYPES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Tempo máximo resposta (horas)" value={maxResponse} onChange={(e) => setMaxResponse(e.target.value)} />
                <Input type="number" placeholder="Tempo máximo resolução (horas)" value={maxResolution} onChange={(e) => setMaxResolution(e.target.value)} />
                <Button onClick={() => createPolicy.mutate()} disabled={!name}>Criar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </RoleGuard>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6 text-center"><Timer className="h-8 w-8 mx-auto text-primary mb-2" /><p className="text-2xl font-bold">{activePolicies}</p><p className="text-sm text-muted-foreground">Políticas Ativas</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-2" /><p className="text-2xl font-bold">{totalViolations}</p><p className="text-sm text-muted-foreground">Violações</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><BarChart3 className="h-8 w-8 mx-auto text-secondary mb-2" /><p className="text-2xl font-bold">{activePolicies > 0 ? Math.round(((activePolicies - totalViolations) / activePolicies) * 100) : 0}%</p><p className="text-sm text-muted-foreground">Taxa Cumprimento</p></CardContent></Card>
      </div>

      <Tabs defaultValue="policies">
        <TabsList>
          <TabsTrigger value="policies">Políticas</TabsTrigger>
          <TabsTrigger value="violations">Violações</TabsTrigger>
        </TabsList>
        <TabsContent value="policies">
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Nome</TableHead><TableHead>Recurso</TableHead><TableHead>Resposta</TableHead><TableHead>Resolução</TableHead><TableHead>Ativo</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {policies?.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell><Badge variant="outline">{RESOURCE_TYPES.find((r) => r.value === p.resource_type)?.label}</Badge></TableCell>
                    <TableCell>{p.max_response_hours ? `${p.max_response_hours}h` : "—"}</TableCell>
                    <TableCell>{p.max_resolution_hours ? `${p.max_resolution_hours}h` : "—"}</TableCell>
                    <TableCell>
                      <RoleGuard permissions={["MANAGE_SLA"]} fallback={<Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Sim" : "Não"}</Badge>}>
                        <Switch checked={p.is_active} onCheckedChange={(v) => togglePolicy.mutate({ id: p.id, active: v })} />
                      </RoleGuard>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && policies?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma política.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="violations">
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Política</TableHead><TableHead>Tipo</TableHead><TableHead>Excedido</TableHead><TableHead>Data</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {violations?.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.sla_policies?.name || "—"}</TableCell>
                    <TableCell>{v.violation_type}</TableCell>
                    <TableCell>{v.exceeded_by_hours ? `${v.exceeded_by_hours}h` : "—"}</TableCell>
                    <TableCell className="text-sm">{format(new Date(v.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>{v.resolved_at ? <Badge variant="secondary"><CheckCircle2 className="h-3 w-3 mr-1" />Resolvido</Badge> : <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Aberto</Badge>}</TableCell>
                  </TableRow>
                ))}
                {violations?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma violação.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SLA;
