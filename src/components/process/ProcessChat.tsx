import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, MessageSquare, Paperclip } from "lucide-react";

interface ProcessChatProps {
  processId: string;
}

const ProcessChat = ({ processId }: ProcessChatProps) => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch profiles for display names
  const { data: profiles = [] } = useQuery({
    queryKey: ["chat-profiles", activeOrgId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, avatar_url");
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId,
  });

  const getProfile = (userId: string) => profiles.find((p) => p.user_id === userId);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["process-chat", processId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("process_chat_messages" as any)
        .select("*")
        .eq("process_id", processId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!processId,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("process_chat_messages" as any).insert({
        process_id: processId,
        organization_id: activeOrgId,
        user_id: user!.id,
        content,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        action: "chat_message_sent",
        user_id: user!.id,
        organization_id: activeOrgId,
        resource_type: "process_chat",
        resource_id: processId,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-chat", processId] });
      setMessage("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    sendMutation.mutate(trimmed);
  };

  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-4 w-4 text-primary" />
        <span className="text-overline text-muted-foreground">Chat do processo</span>
        <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {messages.length} mensagen{messages.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div ref={scrollRef} className="h-48 overflow-y-auto rounded-lg bg-muted/20 border border-border p-3 space-y-3 mb-3">
        {isLoading ? (
          <p className="text-caption text-muted-foreground text-center py-4">Carregando...</p>
        ) : messages.length === 0 ? (
          <p className="text-caption text-muted-foreground text-center py-8">Nenhuma mensagem ainda. Inicie a conversa!</p>
        ) : (
          messages.map((msg: any) => {
            const isMe = msg.user_id === user?.id;
            const profile = getProfile(msg.user_id);
            const initials = (profile?.full_name || "U").charAt(0).toUpperCase();
            return (
              <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarFallback className="text-[10px] bg-primary/20 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className={`max-w-[75%] ${isMe ? "text-right" : ""}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-medium text-foreground">{profile?.full_name || "Usuário"}</span>
                    <span className="text-[9px] text-muted-foreground">
                      {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <div className={`rounded-xl px-3 py-2 text-sm inline-block ${isMe ? "bg-primary/20 text-foreground" : "bg-muted text-foreground"}`}>
                    {msg.content}
                  </div>
                  {msg.attachment_url && (
                    <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-1 mt-1">
                      <Paperclip className="h-3 w-3" /> {msg.attachment_name || "Anexo"}
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Digite uma mensagem..."
          className="flex-1 h-9 text-sm"
        />
        <Button size="sm" onClick={handleSend} disabled={!message.trim() || sendMutation.isPending} className="h-9 px-3">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ProcessChat;
