import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Send, Bot, User, Sparkles, Scale, FileText, Shield, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const Chat = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [conversationId] = useState(() => crypto.randomUUID());
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["chat-messages", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const { error: insertError } = await supabase.from("chat_messages").insert({ user_id: user!.id, conversation_id: conversationId, role: "user", content });
      if (insertError) throw insertError;
      await queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });

      const { data: history } = await supabase.from("chat_messages").select("role, content").eq("conversation_id", conversationId).order("created_at", { ascending: true });
      const messagesForAI = (history || []).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));

      setIsStreaming(true);
      const { data: fnData, error: fnError } = await supabase.functions.invoke("lexia-chat", { body: { messages: messagesForAI } });
      setIsStreaming(false);
      if (fnError) throw fnError;

      const aiContent = fnData?.content || "Desculpe, não consegui processar sua solicitação.";
      const { error: aiInsertError } = await supabase.from("chat_messages").insert({ user_id: user!.id, conversation_id: conversationId, role: "assistant", content: aiContent });
      if (aiInsertError) throw aiInsertError;
      await queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
    },
    onError: (e: any) => { setIsStreaming(false); toast.error("Erro: " + e.message); },
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sendMessage.isPending) return;
    setInput("");
    sendMessage.mutate(trimmed);
  };

  const suggestions = [
    { icon: Scale, text: "Quais processos com risco alto?" },
    { icon: FileText, text: "Gere uma petição inicial" },
    { icon: Shield, text: "Análise de risco do processo" },
    { icon: Zap, text: "Prazos desta semana" },
  ];

  return (
    <div className="flex flex-col h-screen relative">
      {/* Background mesh */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-64 h-64 bg-secondary/5 rounded-full blur-[80px]" />
        <div className="absolute bottom-1/4 left-0 w-48 h-48 bg-primary/5 rounded-full blur-[60px]" />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border glass-strong">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-secondary/20 to-primary/20 border border-secondary/20">
            <Sparkles className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <h1 className="text-display-sm">LexIA Chat</h1>
            <p className="text-caption text-muted-foreground">Assistente jurídico inteligente</p>
          </div>
        </div>
        <LexBadge variant="ai"><span className="h-1.5 w-1.5 rounded-full bg-success mr-1.5 inline-block animate-pulse-glow" />IA Ativa</LexBadge>
      </div>

      {/* Messages */}
      <div className="relative z-10 flex-1 overflow-y-auto px-6 py-6 space-y-5">
        <AnimatePresence>
          {messages.length === 0 && !isStreaming && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full text-center"
            >
              <div className="relative mb-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-secondary/15 to-primary/15 border border-secondary/20">
                  <Bot className="h-10 w-10 text-secondary" />
                </div>
                <div className="absolute -inset-4 rounded-full bg-secondary/5 blur-xl -z-10" />
              </div>
              <h2 className="text-display-md mb-2">Como posso ajudar?</h2>
              <p className="text-body-sm text-muted-foreground max-w-md mb-8">
                Pergunte sobre processos, prazos, jurisprudência ou peça para gerar documentos jurídicos.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
                {suggestions.map((s) => (
                  <button
                    key={s.text}
                    onClick={() => setInput(s.text)}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card/50 p-4 text-left text-body-sm text-muted-foreground hover:border-primary/30 hover:bg-muted/30 hover:text-foreground transition-all group"
                  >
                    <s.icon className="h-4 w-4 text-primary shrink-0 group-hover:scale-110 transition-transform" />
                    {s.text}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {messages.map((msg, i) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
              msg.role === "user"
                ? "bg-gradient-to-br from-primary to-primary/70"
                : "bg-gradient-to-br from-secondary/20 to-primary/20 border border-secondary/20"
            }`}>
              {msg.role === "user"
                ? <User className="h-4 w-4 text-primary-foreground" />
                : <Bot className="h-4 w-4 text-secondary" />
              }
            </div>
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
              msg.role === "user"
                ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-tr-md"
                : "bg-card border border-border rounded-tl-md"
            }`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none text-foreground [&_code]:bg-muted [&_code]:text-primary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-body-sm">{msg.content}</p>
              )}
            </div>
          </motion.div>
        ))}

        {isStreaming && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-secondary/20 to-primary/20 border border-secondary/20">
              <Bot className="h-4 w-4 text-secondary" />
            </div>
            <div className="rounded-2xl rounded-tl-md bg-card border border-border px-5 py-4">
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
                <span className="h-2 w-2 rounded-full bg-secondary animate-pulse-glow" style={{ animationDelay: "200ms" }} />
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" style={{ animationDelay: "400ms" }} />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="relative z-10 border-t border-border px-6 py-4 glass-strong">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-3 max-w-3xl mx-auto">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua pergunta jurídica..."
            className="flex-1 h-12 rounded-xl bg-muted border-border text-base"
            disabled={sendMessage.isPending}
          />
          <Button type="submit" size="icon" className="h-12 w-12 rounded-xl" disabled={!input.trim() || sendMessage.isPending}>
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
