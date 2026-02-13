import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, MessageSquare, Clock, CheckCircle2, AlertTriangle, User } from "lucide-react";
import { format } from "date-fns";

const STATUS_OPTIONS = [
  { value: "open", label: "Aberto", color: "default" },
  { value: "in_progress", label: "Em andamento", color: "secondary" },
  { value: "waiting_client", label: "Aguardando cliente", color: "outline" },
  { value: "resolved", label: "Resolvido", color: "secondary" },
  { value: "closed", label: "Fechado", color: "outline" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const Tickets = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { isClient, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [messageText, setMessageText] = useState("");

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["tickets", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const { data: messages } = useQuery({
    queryKey: ["ticket-messages", detailId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", detailId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!detailId,
  });

  const createTicket = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tickets").insert({
        organization_id: activeOrgId!,
        title,
        description,
        priority,
        created_by: user!.id,
      } as any);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "ticket_created", user_id: user!.id, organization_id: activeOrgId, resource_type: "ticket",
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      toast({ title: "Ticket criado com sucesso" });
    },
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      const ticket = tickets?.find((t: any) => t.id === detailId);
      const { error } = await supabase.from("ticket_messages").insert({
        ticket_id: detailId!,
        organization_id: activeOrgId!,
        sender_id: user!.id,
        content: messageText,
        is_internal: false,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-messages"] });
      setMessageText("");
      toast({ title: "Mensagem enviada" });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("tickets").update({ status } as any).eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "ticket_updated", user_id: user!.id, organization_id: activeOrgId, resource_type: "ticket", resource_id: id, metadata: { status },
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast({ title: "Status atualizado" });
    },
  });

  const selectedTicket = tickets?.find((t: any) => t.id === detailId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tickets</h1>
          <p className="text-muted-foreground">Atendimento e suporte ao cliente</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Ticket</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Ticket</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} />
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => createTicket.mutate()} disabled={!title}>Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className={detailId ? "lg:col-span-1" : "lg:col-span-3"}>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={4}>Carregando...</TableCell></TableRow>}
                {tickets?.map((ticket: any) => (
                  <TableRow key={ticket.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailId(ticket.id)}>
                    <TableCell className="font-medium">{ticket.title}</TableCell>
                    <TableCell>
                      <Badge variant={ticket.priority === "urgent" ? "destructive" : ticket.priority === "high" ? "default" : "secondary"}>
                        {PRIORITY_OPTIONS.find((p) => p.value === ticket.priority)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_OPTIONS.find((s) => s.value === ticket.status)?.color as any}>
                        {STATUS_OPTIONS.find((s) => s.value === ticket.status)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{format(new Date(ticket.created_at), "dd/MM/yyyy")}</TableCell>
                  </TableRow>
                ))}
                {!isLoading && tickets?.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum ticket.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        {detailId && selectedTicket && (
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{selectedTicket.title}</CardTitle>
                  {!isClient && (
                    <Select value={selectedTicket.status} onValueChange={(v) => updateStatus.mutate({ id: detailId, status: v })}>
                      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {selectedTicket.description && <p className="text-sm text-muted-foreground mb-4">{selectedTicket.description}</p>}
                <div className="space-y-3 max-h-80 overflow-y-auto border rounded-lg p-3">
                  {messages?.map((msg: any) => (
                    <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${msg.sender_id === user?.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {msg.content}
                        <p className="text-[10px] opacity-60 mt-1">{format(new Date(msg.created_at), "dd/MM HH:mm")}</p>
                      </div>
                    </div>
                  ))}
                  {messages?.length === 0 && <p className="text-center text-muted-foreground text-sm">Sem mensagens.</p>}
                </div>
                <div className="flex gap-2 mt-3">
                  <Input placeholder="Digite sua mensagem..." value={messageText} onChange={(e) => setMessageText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && messageText && sendMessage.mutate()} />
                  <Button onClick={() => sendMessage.mutate()} disabled={!messageText}>Enviar</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tickets;
