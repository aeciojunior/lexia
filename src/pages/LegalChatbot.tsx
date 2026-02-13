import { useState, useRef, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Bot, Send, Settings, MessageCircle, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

const LegalChatbot = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const canManage = hasPermission("MANAGE_CHATBOTS");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [configForm, setConfigForm] = useState({ name: "Assistente Jurídico", system_prompt: "", tone: "professional", can_open_tickets: true, can_query_processes: true });

  // Load or create config
  const { data: config } = useQuery({
    queryKey: ["chatbot-config", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("chatbot_configs").select("*").eq("organization_id", activeOrgId!).maybeSingle();
      if (error) throw error;
      if (data) setConfigForm({ name: data.name, system_prompt: data.system_prompt || "", tone: data.tone, can_open_tickets: data.can_open_tickets, can_query_processes: data.can_query_processes });
      return data;
    },
    enabled: !!activeOrgId,
  });

  // Load conversations
  const { data: conversations = [] } = useQuery({
    queryKey: ["chatbot-conversations", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("chatbot_conversations").select("*").eq("organization_id", activeOrgId!).eq("user_id", user!.id).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId && !!user,
  });

  // Load messages for current conversation
  const { data: messages = [] } = useQuery({
    queryKey: ["chatbot-messages", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase.from("chatbot_messages").select("*").eq("conversation_id", conversationId!).order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!conversationId,
  });

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      let convId = conversationId;
      if (!convId) {
        const { data, error } = await supabase.from("chatbot_conversations").insert({ organization_id: activeOrgId!, user_id: user!.id }).select().single();
        if (error) throw error;
        convId = data.id;
        setConversationId(convId);
      }

      // Save user message
      await supabase.from("chatbot_messages").insert({ organization_id: activeOrgId!, conversation_id: convId, role: "user", content: text });

      // Call edge function
      const { data, error } = await supabase.functions.invoke("chatbot-legal", {
        body: { conversationId: convId, organizationId: activeOrgId, message: text, userId: user!.id },
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["chatbot-messages", convId] });
      queryClient.invalidateQueries({ queryKey: ["chatbot-conversations"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate(message);
    setMessage("");
  };

  const saveConfig = useMutation({
    mutationFn: async () => {
      if (config) {
        await supabase.from("chatbot_configs").update({ ...configForm, system_prompt: configForm.system_prompt || null }).eq("id", config.id);
      } else {
        await supabase.from("chatbot_configs").insert({ organization_id: activeOrgId!, ...configForm, system_prompt: configForm.system_prompt || null, created_by: user!.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatbot-config"] });
      setConfigOpen(false);
      toast({ title: "Configuração salva" });
    },
  });

  const startNewConversation = () => setConversationId(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Chatbot Jurídico</h1>
          <p className="text-muted-foreground">Atendimento automatizado com IA</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={startNewConversation}><MessageCircle className="h-4 w-4 mr-2" />Nova Conversa</Button>
          {canManage && (
            <Dialog open={configOpen} onOpenChange={setConfigOpen}>
              <DialogTrigger asChild><Button variant="outline"><Settings className="h-4 w-4 mr-2" />Configurar</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Configurar Chatbot</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Nome do Assistente</Label><Input value={configForm.name} onChange={e => setConfigForm(f => ({ ...f, name: e.target.value }))} /></div>
                  <div><Label>Instruções do Sistema</Label><Textarea value={configForm.system_prompt} onChange={e => setConfigForm(f => ({ ...f, system_prompt: e.target.value }))} rows={4} placeholder="Instruções personalizadas para o comportamento do chatbot..." /></div>
                  <div className="flex items-center justify-between"><Label>Pode abrir tickets</Label><Switch checked={configForm.can_open_tickets} onCheckedChange={v => setConfigForm(f => ({ ...f, can_open_tickets: v }))} /></div>
                  <div className="flex items-center justify-between"><Label>Pode consultar processos</Label><Switch checked={configForm.can_query_processes} onCheckedChange={v => setConfigForm(f => ({ ...f, can_query_processes: v }))} /></div>
                  <Button onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending} className="w-full">Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-[calc(100vh-220px)]">
        {/* Conversations sidebar */}
        <Card className="md:col-span-1 overflow-y-auto">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Conversas</CardTitle></CardHeader>
          <CardContent className="space-y-1 p-2">
            {conversations.map(c => (
              <button
                key={c.id}
                onClick={() => setConversationId(c.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${c.id === conversationId ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
              >
                <p className="truncate">{c.summary || "Nova conversa"}</p>
                <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</p>
              </button>
            ))}
            {conversations.length === 0 && <p className="text-xs text-muted-foreground text-center p-4">Nenhuma conversa</p>}
          </CardContent>
        </Card>

        {/* Chat area */}
        <Card className="md:col-span-3 flex flex-col">
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {!conversationId && messages.length === 0 && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Bot className="h-16 w-16 mx-auto text-primary/40 mb-4" />
                  <h3 className="text-lg font-semibold text-foreground">{config?.name || "Assistente Jurídico"}</h3>
                  <p className="text-muted-foreground text-sm mt-1">Como posso ajudar? Pergunte sobre processos, prazos ou abra um ticket.</p>
                </div>
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-xl px-4 py-3 ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                  <p className="text-[10px] mt-1 opacity-60">{new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            ))}
            {sendMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-xl px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Pensando...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </CardContent>

          {/* Input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                disabled={sendMutation.isPending}
              />
              <Button onClick={handleSend} disabled={!message.trim() || sendMutation.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LegalChatbot;
