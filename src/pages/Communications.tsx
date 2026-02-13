import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LexCard } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Mail, MessageCircle, Send, Inbox, ArrowUpRight, ArrowDownLeft, Search, Paperclip } from "lucide-react";
import { motion } from "framer-motion";

const CHANNELS = [
  { value: "email", label: "E-mail", icon: Mail },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
];

const Statuses: Record<string, { label: string; color: string }> = {
  sent: { label: "Enviado", color: "bg-green-500/20 text-green-400" },
  delivered: { label: "Entregue", color: "bg-blue-500/20 text-blue-400" },
  read: { label: "Lido", color: "bg-emerald-500/20 text-emerald-400" },
  failed: { label: "Falhou", color: "bg-red-500/20 text-red-400" },
  received: { label: "Recebido", color: "bg-cyan-500/20 text-cyan-400" },
  draft: { label: "Rascunho", color: "bg-muted text-muted-foreground" },
};

const Communications = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterDirection, setFilterDirection] = useState("all");

  const [form, setForm] = useState({
    channel: "email", subject: "", body: "", recipient_email: "",
    recipient_phone: "", recipient_name: "", process_id: "", client_id: "",
  });

  const resetForm = () => setForm({ channel: "email", subject: "", body: "", recipient_email: "", recipient_phone: "", recipient_name: "", process_id: "", client_id: "" });

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["external-messages", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_messages" as any)
        .select("*, processes(title, number), clients(full_name)")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-comm", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name, email, phone").eq("organization_id", activeOrgId!).eq("status", "active").order("full_name");
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: processes = [] } = useQuery({
    queryKey: ["processes-comm", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("processes").select("id, title, number").eq("organization_id", activeOrgId!).eq("archived", false).order("title");
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const sendMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload: any = {
        organization_id: activeOrgId, user_id: user!.id, channel: values.channel,
        direction: "outbound", subject: values.subject || null, body: values.body,
        recipient_email: values.recipient_email || null, recipient_phone: values.recipient_phone || null,
        recipient_name: values.recipient_name || null, status: "sent", sent_at: new Date().toISOString(),
        process_id: values.process_id || null, client_id: values.client_id || null,
      };
      const { data, error } = await supabase.from("external_messages" as any).insert(payload).select("id").single();
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "external_message_sent", user_id: user!.id, organization_id: activeOrgId,
        resource_type: "external_message", resource_id: (data as any).id,
        metadata: { channel: values.channel, recipient: values.recipient_email || values.recipient_phone },
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-messages"] });
      toast.success("Mensagem registrada!");
      setOpen(false); resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    return messages.filter((m: any) => {
      if (filterChannel !== "all" && m.channel !== filterChannel) return false;
      if (filterDirection !== "all" && m.direction !== filterDirection) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!m.subject?.toLowerCase().includes(s) && !m.body?.toLowerCase().includes(s) && !m.recipient_name?.toLowerCase().includes(s) && !m.recipient_email?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [messages, filterChannel, filterDirection, search]);

  const canSend = hasPermission("SEND_EXTERNAL_MESSAGES");

  const selectClient = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setForm({ ...form, client_id: clientId, recipient_name: client.full_name || "", recipient_email: client.email || "", recipient_phone: client.phone || "" });
    }
  };

  const inbound = messages.filter((m: any) => m.direction === "inbound").length;
  const outbound = messages.filter((m: any) => m.direction === "outbound").length;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-primary mb-0.5">Comunicação</p>
              <h1 className="text-2xl font-bold text-foreground">Comunicações Externas</h1>
            </div>
          </div>
          {canSend && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Send className="h-4 w-4" /> Nova Mensagem</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Enviar Mensagem</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); sendMutation.mutate(form); }} className="space-y-4">
                  <div>
                    <Label>Canal</Label>
                    <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Cliente</Label>
                    <Select value={form.client_id} onValueChange={selectClient}>
                      <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                      <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Nome Destinatário</Label><Input value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} /></div>
                    {form.channel === "email" ? (
                      <div><Label>E-mail *</Label><Input type="email" value={form.recipient_email} onChange={(e) => setForm({ ...form, recipient_email: e.target.value })} required /></div>
                    ) : (
                      <div><Label>Telefone *</Label><Input value={form.recipient_phone} onChange={(e) => setForm({ ...form, recipient_phone: e.target.value })} placeholder="+55..." required /></div>
                    )}
                  </div>
                  <div>
                    <Label>Processo</Label>
                    <Select value={form.process_id} onValueChange={(v) => setForm({ ...form, process_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>{processes.map((p) => <SelectItem key={p.id} value={p.id}>{p.number} — {p.title}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {form.channel === "email" && <div><Label>Assunto</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>}
                  <div><Label>Mensagem *</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={5} required /></div>
                  <Button type="submit" className="w-full gap-2" disabled={sendMutation.isPending || !form.body}>
                    {sendMutation.isPending ? "Enviando..." : <><Send className="h-4 w-4" /> Enviar</>}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <LexCard hover={false}>
          <div className="flex items-center gap-3 p-1">
            <Inbox className="h-6 w-6 text-primary" />
            <div><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold">{messages.length}</p></div>
          </div>
        </LexCard>
        <LexCard hover={false}>
          <div className="flex items-center gap-3 p-1">
            <ArrowUpRight className="h-6 w-6 text-green-400" />
            <div><p className="text-xs text-muted-foreground">Enviadas</p><p className="text-xl font-bold">{outbound}</p></div>
          </div>
        </LexCard>
        <LexCard hover={false}>
          <div className="flex items-center gap-3 p-1">
            <ArrowDownLeft className="h-6 w-6 text-cyan-400" />
            <div><p className="text-xs text-muted-foreground">Recebidas</p><p className="text-xl font-bold">{inbound}</p></div>
          </div>
        </LexCard>
      </div>

      {/* Filters */}
      <LexCard hover={false}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar mensagens..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Select value={filterChannel} onValueChange={setFilterChannel}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos canais</SelectItem>
                {CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterDirection} onValueChange={setFilterDirection}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="outbound">Enviadas</SelectItem>
                <SelectItem value="inbound">Recebidas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </LexCard>

      {/* Messages list */}
      <div className="grid gap-3">
        {isLoading ? (
          <LexCard hover={false}><p className="text-center text-muted-foreground py-6">Carregando...</p></LexCard>
        ) : filtered.length === 0 ? (
          <LexCard hover={false}>
            <div className="text-center py-10 space-y-2">
              <Mail className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-muted-foreground">Nenhuma mensagem encontrada.</p>
            </div>
          </LexCard>
        ) : (
          filtered.map((m: any) => {
            const statusInfo = Statuses[m.status] || Statuses.sent;
            const isEmail = m.channel === "email";
            const ChannelIcon = isEmail ? Mail : MessageCircle;
            return (
              <LexCard key={m.id} className="hover:border-primary/30 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {m.direction === "outbound" ? <ArrowUpRight className="h-4 w-4 text-green-400 shrink-0" /> : <ArrowDownLeft className="h-4 w-4 text-cyan-400 shrink-0" />}
                      <ChannelIcon className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-semibold text-foreground truncate">{m.subject || m.recipient_name || (isEmail ? m.recipient_email : m.recipient_phone)}</span>
                      <Badge className={`text-xs shrink-0 ${statusInfo.color}`}>{statusInfo.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{m.body}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{format(new Date(m.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                      {m.recipient_email && <span>{m.recipient_email}</span>}
                      {m.processes && <span>Proc: {(m.processes as any).number}</span>}
                      {m.clients && <span>Cliente: {(m.clients as any).full_name}</span>}
                    </div>
                  </div>
                </div>
              </LexCard>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Communications;
