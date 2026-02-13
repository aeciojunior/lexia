import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Landmark, Plus, Users, Calendar, Gavel } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Governance = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const canManage = hasPermission("MANAGE_GOVERNANCE");

  // Committee form
  const [committeeOpen, setCommitteeOpen] = useState(false);
  const [committeeForm, setCommitteeForm] = useState({ name: "", description: "", purpose: "" });

  const { data: committees = [] } = useQuery({
    queryKey: ["governance-committees", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("governance_committees").select("*").eq("organization_id", activeOrgId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["governance-meetings", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("governance_meetings").select("*").eq("organization_id", activeOrgId!).order("meeting_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const { data: decisions = [] } = useQuery({
    queryKey: ["governance-decisions", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("governance_decisions").select("*").eq("organization_id", activeOrgId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const createCommittee = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("governance_committees").insert({
        organization_id: activeOrgId!,
        name: committeeForm.name,
        description: committeeForm.description,
        purpose: committeeForm.purpose,
        created_by: user!.id,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "governance_committee_created", user_id: user!.id, organization_id: activeOrgId!, resource_type: "governance_committee", metadata: { name: committeeForm.name } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-committees"] });
      setCommitteeOpen(false);
      setCommitteeForm({ name: "", description: "", purpose: "" });
      toast({ title: "Comitê criado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Governança Corporativa</h1>
        <p className="text-muted-foreground">Comitês, reuniões, decisões e políticas</p>
      </div>

      <Tabs defaultValue="committees">
        <TabsList>
          <TabsTrigger value="committees">Comitês ({committees.length})</TabsTrigger>
          <TabsTrigger value="meetings">Reuniões ({meetings.length})</TabsTrigger>
          <TabsTrigger value="decisions">Decisões ({decisions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="committees" className="space-y-4">
          {canManage && (
            <Dialog open={committeeOpen} onOpenChange={setCommitteeOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo Comitê</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Criar Comitê</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Nome</Label><Input value={committeeForm.name} onChange={e => setCommitteeForm(f => ({ ...f, name: e.target.value }))} /></div>
                  <div><Label>Propósito</Label><Input value={committeeForm.purpose} onChange={e => setCommitteeForm(f => ({ ...f, purpose: e.target.value }))} /></div>
                  <div><Label>Descrição</Label><Textarea value={committeeForm.description} onChange={e => setCommitteeForm(f => ({ ...f, description: e.target.value }))} /></div>
                  <Button onClick={() => createCommittee.mutate()} disabled={!committeeForm.name || createCommittee.isPending} className="w-full">Criar</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {committees.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhum comitê</p></CardContent></Card>
          ) : committees.map(c => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{c.name}</CardTitle>
                  <Badge variant={c.status === "active" ? "default" : "outline"}>{c.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {c.purpose && <p className="text-sm text-muted-foreground">{c.purpose}</p>}
                {c.members && <p className="text-xs text-muted-foreground mt-1">{(c.members as string[]).length} membro(s)</p>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="meetings" className="space-y-4">
          {meetings.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhuma reunião</p></CardContent></Card>
          ) : meetings.map(m => (
            <Card key={m.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{m.title}</CardTitle>
                    <Badge variant="outline">{m.status}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{format(new Date(m.meeting_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                </div>
              </CardHeader>
              {m.description && <CardContent><p className="text-sm text-muted-foreground">{m.description}</p></CardContent>}
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="decisions" className="space-y-4">
          {decisions.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><Gavel className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhuma decisão</p></CardContent></Card>
          ) : decisions.map(d => (
            <Card key={d.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Gavel className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{d.title}</CardTitle>
                    <Badge variant={d.status === "implemented" ? "default" : d.status === "pending" ? "outline" : "secondary"}>{d.status}</Badge>
                    <Badge variant="outline">{d.priority}</Badge>
                  </div>
                  {d.deadline && <span className="text-xs text-muted-foreground">Prazo: {format(new Date(d.deadline), "dd/MM/yyyy", { locale: ptBR })}</span>}
                </div>
              </CardHeader>
              {d.description && <CardContent><p className="text-sm text-muted-foreground">{d.description}</p></CardContent>}
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Governance;
