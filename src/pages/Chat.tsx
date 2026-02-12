import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LexLogo } from "@/components/lexia/LexLogo";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Send, Bot, User, Sparkles, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";


const Chat = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [conversationId] = useState(() => crypto.randomUUID());
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["chat-messages", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      // Save user message
      const { error: insertError } = await supabase.from("chat_messages").insert({
        user_id: user!.id,
        conversation_id: conversationId,
        role: "user",
        content,
      });
      if (insertError) throw insertError;

      await queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });

      // Build conversation history for AI
      const { data: history } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      const messagesForAI = (history || []).map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));

      // Call edge function
      setIsStreaming(true);
      setStreamingContent("");

      const { data: fnData, error: fnError } = await supabase.functions.invoke("lexia-chat", {
        body: { messages: messagesForAI },
      });

      setIsStreaming(false);

      if (fnError) throw fnError;

      const aiContent = fnData?.content || "Desculpe, não consegui processar sua solicitação.";

      // Save AI response
      const { error: aiInsertError } = await supabase.from("chat_messages").insert({
        user_id: user!.id,
        conversation_id: conversationId,
        role: "assistant",
        content: aiContent,
      });
      if (aiInsertError) throw aiInsertError;

      await queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
    },
    onError: (e: any) => {
      setIsStreaming(false);
      toast.error("Erro ao enviar mensagem: " + e.message);
    },
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sendMessage.isPending) return;
    setInput("");
    sendMessage.mutate(trimmed);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
            <Sparkles className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <h1 className="text-display-sm">LexIA Chat</h1>
            <p className="text-caption text-muted-foreground">Assistente jurídico inteligente</p>
          </div>
        </div>
        <LexBadge variant="ai">IA Ativa</LexBadge>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/10 mb-4">
              <Bot className="h-8 w-8 text-secondary" />
            </div>
            <h2 className="text-display-sm mb-2">Como posso ajudar?</h2>
            <p className="text-body-sm text-muted-foreground max-w-md">
              Pergunte sobre processos, prazos, jurisprudência ou peça para gerar documentos jurídicos.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 max-w-lg">
              {[
                "Quais são meus processos com risco alto?",
                "Gere uma petição inicial para ação cível",
                "Quais prazos vencem esta semana?",
                "Explique o artigo 5º da CF",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => { setInput(suggestion); }}
                  className="text-left rounded-lg border border-border p-3 text-body-sm text-muted-foreground hover:border-primary/30 hover:bg-muted/50 transition-all"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
              {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div className={`max-w-[75%] rounded-xl px-4 py-3 ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm"}`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none text-foreground">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-body-sm">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-xl rounded-tl-sm bg-muted px-4 py-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-secondary animate-pulse-glow" />
                <span className="h-2 w-2 rounded-full bg-secondary animate-pulse-glow" style={{ animationDelay: "200ms" }} />
                <span className="h-2 w-2 rounded-full bg-secondary animate-pulse-glow" style={{ animationDelay: "400ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-6 py-4">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-3 max-w-3xl mx-auto"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua pergunta jurídica..."
            className="flex-1"
            disabled={sendMessage.isPending}
          />
          <Button type="submit" disabled={!input.trim() || sendMessage.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
