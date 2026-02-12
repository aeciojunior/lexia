import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { LexCard } from "@/components/lexia/LexCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Sparkles, Lock, Copy, Download, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const pieceTypes = [
  { value: "peticao_inicial", label: "Petição Inicial" },
  { value: "contestacao", label: "Contestação" },
  { value: "recurso", label: "Recurso" },
  { value: "contrato", label: "Contrato" },
  { value: "parecer", label: "Parecer" },
  { value: "minuta", label: "Minuta" },
];

const AILegalDocs = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission, isIntern } = usePermissions();
  const [pieceType, setPieceType] = useState("peticao_inicial");
  const [processId, setProcessId] = useState<string>("none");
  const [instructions, setInstructions] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const canUseAI = hasPermission("USE_IA_ADVANCED") || (isIntern && hasPermission("USE_IA_BASIC"));

  // Fetch processes for context
  const { data: processes = [] } = useQuery({
    queryKey: ["processes-for-ai", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("processes").select("id, title, number, client_name").eq("archived", false).order("title");
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrgId && canUseAI,
  });

  const handleGenerate = async () => {
    if (!instructions.trim()) {
      toast.error("Forneça instruções para a geração.");
      return;
    }
    setIsGenerating(true);
    setGeneratedContent("");

    try {
      const selectedProcess = processId !== "none" ? processes.find(p => p.id === processId) : null;

      const resp = await supabase.functions.invoke("generate-legal-piece", {
        body: {
          piece_type: pieceType,
          instructions: instructions.trim(),
          process_context: selectedProcess ? {
            title: selectedProcess.title,
            number: selectedProcess.number,
            client_name: selectedProcess.client_name,
          } : null,
        },
      });

      if (resp.error) throw resp.error;

      const content = resp.data?.content || "Nenhum conteúdo gerado.";
      setGeneratedContent(content);

      // Audit log
      await supabase.from("audit_logs").insert({
        action: "ai_piece_generated",
        user_id: user!.id,
        organization_id: activeOrgId,
        resource_type: "ai_piece",
        metadata: {
          piece_type: pieceType,
          process_id: processId !== "none" ? processId : null,
          instructions_length: instructions.length,
        },
      } as any);

      toast.success("Peça gerada com sucesso!");
    } catch (e: any) {
      console.error("AI generation error:", e);
      if (e?.message?.includes("429") || e?.context?.status === 429) {
        toast.error("Limite de requisições excedido. Tente novamente em alguns minutos.");
      } else if (e?.message?.includes("402") || e?.context?.status === 402) {
        toast.error("Créditos insuficientes. Entre em contato com o administrador.");
      } else {
        toast.error(e?.message || "Erro ao gerar peça jurídica.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedContent);
    toast.success("Conteúdo copiado!");
  };

  if (!canUseAI) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Lock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-display-sm text-muted-foreground">Acesso restrito</h2>
          <p className="text-body-sm text-muted-foreground/60 mt-2">Você não tem permissão para usar a IA jurídica.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-overline text-secondary mb-1">IA Jurídica</p>
        <h1 className="text-display-lg">Gerador de Peças</h1>
        <p className="text-body-sm text-muted-foreground mt-1">Gere peças jurídicas com auxílio de inteligência artificial</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <LexCard hover={false} className="h-full">
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-secondary" /> Configuração
              </h3>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Tipo de peça</label>
                <Select value={pieceType} onValueChange={setPieceType}>
                  <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {pieceTypes.map(pt => <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Processo vinculado (opcional)</label>
                <Select value={processId} onValueChange={setProcessId}>
                  <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue placeholder="Selecionar processo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {processes.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.number} — {p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Instruções e contexto <span className="text-destructive">*</span></label>
                <Textarea
                  className="bg-muted border-border rounded-xl min-h-[200px]"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Descreva os fatos, argumentos e detalhes relevantes para a peça jurídica..."
                  rows={8}
                />
              </div>
              <Button variant="ai" className="w-full" onClick={handleGenerate} disabled={isGenerating || !instructions.trim()}>
                {isGenerating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Gerar Peça</>
                )}
              </Button>
            </div>
          </LexCard>
        </motion.div>

        {/* Output Panel */}
        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
          <LexCard hover={false} className="h-full">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> Resultado
                </h3>
                {generatedContent && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                      <Copy className="h-3.5 w-3.5" /> Copiar
                    </Button>
                  </div>
                )}
              </div>
              {isGenerating ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 text-secondary animate-spin mx-auto mb-3" />
                    <p className="text-body-sm text-muted-foreground">Gerando peça jurídica...</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Isso pode levar alguns segundos</p>
                  </div>
                </div>
              ) : generatedContent ? (
                <div className="prose prose-invert prose-sm max-w-none overflow-y-auto max-h-[60vh] rounded-xl bg-muted/30 p-4 border border-border">
                  <ReactMarkdown>{generatedContent}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <FileText className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-body-sm text-muted-foreground">O resultado aparecerá aqui</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Configure e clique em "Gerar Peça"</p>
                  </div>
                </div>
              )}
            </div>
          </LexCard>
        </motion.div>
      </div>
    </div>
  );
};

export default AILegalDocs;
