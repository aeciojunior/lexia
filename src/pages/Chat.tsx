import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Bot, User, Sparkles, Scale, FileText, Shield, Zap, X, History, ChevronRight, Gavel, AlertTriangle, BookOpen, Mic, MicOff } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const Chat = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [conversationId] = useState(() => crypto.randomUUID());
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Web Speech API setup
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Seu navegador não suporta reconhecimento de voz.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (e: any) => {
      setIsListening(false);
      if (e.error !== "aborted") toast.error("Erro no reconhecimento de voz: " + e.error);
    };
    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results as SpeechRecognitionResultList)
        .map((r: any) => r[0].transcript)
        .join("");
      setInput(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort?.();
      recognitionRef.current = null;
    };
  }, []);

  // Fetch org processes for context selector
  const { data: processes = [] } = useQuery({
    queryKey: ["chat-processes", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processes")
        .select("id, title, number, status")
        .eq("organization_id", activeOrgId!)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  // Fetch chat messages
  const { data: messages = [] } = useQuery({
    queryKey: ["chat-messages", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch NL query history
  const { data: queryHistory = [] } = useQuery({
    queryKey: ["nl-query-history", activeOrgId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nl_queries" as any)
        .select("id, question, query_type, created_at")
        .eq("organization_id", activeOrgId!)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId && !!user,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const selectedProcess = processes.find((p) => p.id === selectedProcessId);

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const { error: insertError } = await supabase.from("chat_messages").insert({
        user_id: user!.id,
        conversation_id: conversationId,
        role: "user",
        content,
        organization_id: activeOrgId,
      } as any);
      if (insertError) throw insertError;
      await queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });

      const { data: history } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      const messagesForAI = (history || []).map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));

      setIsStreaming(true);
      const { data: fnData, error: fnError } = await supabase.functions.invoke("lexia-chat", {
        body: {
          messages: messagesForAI,
          processId: selectedProcessId || undefined,
          conversationId,
        },
      });
      setIsStreaming(false);

      if (fnError) throw fnError;

      // Handle rate limit / payment errors
      if (fnData?.error) {
        toast.error(fnData.error);
        return;
      }

      const aiContent = fnData?.content || "Desculpe, não consegui processar sua solicitação.";
      const { error: aiInsertError } = await supabase.from("chat_messages").insert({
        user_id: user!.id,
        conversation_id: conversationId,
        role: "assistant",
        content: aiContent,
        organization_id: activeOrgId,
      } as any);
      if (aiInsertError) throw aiInsertError;
      await queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["nl-query-history"] });
    },
    onError: (e: any) => {
      setIsStreaming(false);
      toast.error("Erro: " + e.message);
    },
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sendMessage.isPending) return;
    setInput("");
    sendMessage.mutate(trimmed);
  };

  const suggestionsWithProcess = [
    { icon: Zap, text: "Quais os prazos deste processo?" },
    { icon: AlertTriangle, text: "Qual o risco jurídico deste caso?" },
    { icon: Gavel, text: "Resumo das movimentações recentes" },
    { icon: FileText, text: "Quais documentos estão pendentes?" },
  ];

  const suggestionsGeneral = [
    { icon: Scale, text: "Quais processos com risco alto?" },
    { icon: FileText, text: "Gere uma petição inicial" },
    { icon: BookOpen, text: "Buscar jurisprudência sobre danos morais" },
    { icon: Zap, text: "Prazos desta semana" },
  ];

  const suggestions = selectedProcessId ? suggestionsWithProcess : suggestionsGeneral;

  return (
    <div className="flex h-screen relative">
      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Background mesh */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/4 w-64 h-64 bg-secondary/5 rounded-full blur-[80px]" />
          <div className="absolute bottom-1/4 left-0 w-48 h-48 bg-primary/5 rounded-full blur-[60px]" />
        </div>

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border glass-strong gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-secondary/20 to-primary/20 border border-secondary/20">
              <Sparkles className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <h1 className="text-display-sm">LexIA Chat</h1>
              <p className="text-caption text-muted-foreground">Assistente jurídico inteligente</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Process context selector */}
            <div className="flex items-center gap-2">
              <Select
                value={selectedProcessId || "none"}
                onValueChange={(v) => setSelectedProcessId(v === "none" ? null : v)}
              >
                <SelectTrigger className="w-[220px] h-9 text-xs rounded-lg">
                  <SelectValue placeholder="Selecionar processo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem contexto de processo</SelectItem>
                  {processes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.number || p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProcessId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setSelectedProcessId(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="h-4 w-4" />
            </Button>

            <LexBadge variant="ai">
              <span className="h-1.5 w-1.5 rounded-full bg-success mr-1.5 inline-block animate-pulse-glow" />
              IA Ativa
            </LexBadge>
          </div>
        </div>

        {/* Selected process badge */}
        {selectedProcess && (
          <div className="relative z-10 px-6 py-2 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2 text-body-sm">
              <Scale className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Contexto:</span>
              <span className="font-medium text-foreground">{selectedProcess.number || selectedProcess.title}</span>
              <LexBadge variant="default" className="text-xs">{selectedProcess.status}</LexBadge>
            </div>
          </div>
        )}

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
                <h2 className="text-display-md mb-2">
                  {selectedProcessId ? "Pergunte sobre este processo" : "Como posso ajudar?"}
                </h2>
                <p className="text-body-sm text-muted-foreground max-w-md mb-8">
                  {selectedProcessId
                    ? "Faça perguntas sobre prazos, riscos, movimentações, documentos e mais."
                    : "Pergunte sobre processos, prazos, jurisprudência ou peça para gerar documentos jurídicos."}
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

          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-primary to-primary/70"
                    : "bg-gradient-to-br from-secondary/20 to-primary/20 border border-secondary/20"
                }`}
              >
                {msg.role === "user" ? (
                  <User className="h-4 w-4 text-primary-foreground" />
                ) : (
                  <Bot className="h-4 w-4 text-secondary" />
                )}
              </div>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-tr-md"
                    : "bg-card border border-border rounded-tl-md"
                }`}
              >
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-3 max-w-3xl mx-auto"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                selectedProcessId
                  ? "Pergunte sobre este processo..."
                  : "Digite sua pergunta jurídica..."
              }
              className="flex-1 h-12 rounded-xl bg-muted border-border text-base"
              disabled={sendMessage.isPending}
            />
            <Button
              type="button"
              size="icon"
              variant={isListening ? "destructive" : "outline"}
              className={`h-12 w-12 rounded-xl shrink-0 ${isListening ? "animate-pulse" : ""}`}
              onClick={isListening ? stopListening : startListening}
              disabled={sendMessage.isPending}
            >
              {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            <Button type="submit" size="icon" className="h-12 w-12 rounded-xl" disabled={!input.trim() || sendMessage.isPending}>
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </div>
      </div>

      {/* Query History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 border-l border-border bg-card overflow-hidden shrink-0"
          >
            <div className="w-[320px] h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-label font-semibold flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico de Consultas
                </h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHistory(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {queryHistory.length === 0 && (
                  <p className="text-caption text-muted-foreground text-center py-8">Nenhuma consulta ainda.</p>
                )}
                {queryHistory.map((q: any) => (
                  <button
                    key={q.id}
                    onClick={() => setInput(q.question)}
                    className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors group"
                  >
                    <p className="text-body-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                      {q.question}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <LexBadge variant="default" className="text-[10px]">{q.query_type}</LexBadge>
                      <span className="text-caption text-muted-foreground">
                        {new Date(q.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Chat;
