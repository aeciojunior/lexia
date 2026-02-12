import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Button } from "@/components/ui/button";
import { RiskIndicator } from "@/components/lexia/LegalComponents";
import {
  Scale, FileText, Download, Eye, MessageSquare, Shield, FolderOpen,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useState } from "react";
import { Navigate } from "react-router-dom";

const statusMap: Record<string, string> = { active: "Ativo", pending: "Pendente", closed: "Encerrado", suspended: "Suspenso" };
const typeMap: Record<string, string> = { civil: "Cível", criminal: "Criminal", labor: "Trabalhista", tax: "Tributário", admin: "Administrativo" };
const categoryMap: Record<string, string> = {
  petition: "Petição", contract: "Contrato", evidence: "Prova", court_order: "Decisão Judicial",
  correspondence: "Correspondência", power_of_attorney: "Procuração", report: "Relatório", other: "Outro",
};

const ClientPortal = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { isClient, isLoading: loadingPerms } = usePermissions();
  const [selectedProcess, setSelectedProcess] = useState<any>(null);
  const [viewProcessDialog, setViewProcessDialog] = useState(false);

  // Redirect non-clients to dashboard
  if (!loadingPerms && !isClient) {
    return <Navigate to="/dashboard" replace />;
  }

  // Fetch processes (RLS already scopes to org)
  const { data: processes = [], isLoading: loadingProcesses } = useQuery({
    queryKey: ["client-processes", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processes")
        .select("*")
        .eq("archived", false)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  // Fetch documents (RLS scoped)
  const { data: documents = [], isLoading: loadingDocs } = useQuery({
    queryKey: ["client-documents", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*, processes(title, number)")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const downloadFile = async (doc: any) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.file_url, 60);
    if (error) {
      toast.error("Erro ao gerar link de download");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loadingPerms) return null;

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-5xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-overline text-primary mb-0.5">Portal do Cliente</p>
            <h1 className="text-display-lg">Meus Processos</h1>
          </div>
        </div>
        <p className="text-body-sm text-muted-foreground mt-1">
          Acompanhe seus processos e documentos autorizados
        </p>
      </motion.div>

      {/* Processes */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <LexCard hover={false}>
          <LexCardHeader>
            <LexCardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" /> Processos ({processes.length})
            </LexCardTitle>
          </LexCardHeader>

          {loadingProcesses ? (
            <div className="py-12 text-center">
              <div className="flex gap-1.5 justify-center mb-3">
                <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse-glow" />
                <span className="h-2.5 w-2.5 rounded-full bg-secondary animate-pulse-glow" style={{ animationDelay: "200ms" }} />
                <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse-glow" style={{ animationDelay: "400ms" }} />
              </div>
            </div>
          ) : processes.length === 0 ? (
            <div className="py-12 text-center">
              <Scale className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-body-sm text-muted-foreground">Nenhum processo encontrado.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {processes.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => { setSelectedProcess(p); setViewProcessDialog(true); }}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shrink-0">
                      <Scale className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-body-sm font-medium">{p.title}</p>
                      <p className="text-caption text-muted-foreground">
                        <span className="font-mono text-primary">{p.number}</span> • {typeMap[p.type] || p.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <RiskIndicator level={p.risk_level as any || "low"} />
                    <LexBadge variant={p.status === "active" ? "success" : p.status === "closed" ? "default" : "warning"}>
                      {statusMap[p.status] || p.status}
                    </LexBadge>
                    <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </LexCard>
      </motion.div>

      {/* Documents */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <LexCard hover={false}>
          <LexCardHeader>
            <LexCardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Documentos ({documents.length})
            </LexCardTitle>
          </LexCardHeader>

          {loadingDocs ? (
            <div className="py-12 text-center">
              <div className="flex gap-1.5 justify-center mb-3">
                <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse-glow" />
                <span className="h-2.5 w-2.5 rounded-full bg-secondary animate-pulse-glow" style={{ animationDelay: "200ms" }} />
              </div>
            </div>
          ) : documents.length === 0 ? (
            <div className="py-12 text-center">
              <FolderOpen className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-body-sm text-muted-foreground">Nenhum documento disponível.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc: any, i: number) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-body-sm font-medium truncate max-w-xs">{doc.file_name}</p>
                      <p className="text-caption text-muted-foreground">
                        {categoryMap[doc.category] || doc.category} • {formatFileSize(doc.file_size)} • {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                        {doc.processes && <span> • <span className="font-mono text-primary">{doc.processes.number}</span></span>}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => downloadFile(doc)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </LexCard>
      </motion.div>

      {/* Process Detail Dialog */}
      <Dialog open={viewProcessDialog} onOpenChange={setViewProcessDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Detalhes do Processo</DialogTitle></DialogHeader>
          {selectedProcess && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-body-sm">
                <div><span className="text-overline text-muted-foreground block mb-0.5">Número</span><span className="font-mono text-primary">{selectedProcess.number}</span></div>
                <div><span className="text-overline text-muted-foreground block mb-0.5">Cliente</span>{selectedProcess.client_name}</div>
                <div><span className="text-overline text-muted-foreground block mb-0.5">Título</span>{selectedProcess.title}</div>
                <div><span className="text-overline text-muted-foreground block mb-0.5">Tipo</span>{typeMap[selectedProcess.type] || selectedProcess.type}</div>
                <div>
                  <span className="text-overline text-muted-foreground block mb-0.5">Status</span>
                  <LexBadge variant={selectedProcess.status === "active" ? "success" : "warning"}>
                    {statusMap[selectedProcess.status]}
                  </LexBadge>
                </div>
                <div><span className="text-overline text-muted-foreground block mb-0.5">Risco</span><RiskIndicator level={selectedProcess.risk_level || "low"} /></div>
                {selectedProcess.court && <div><span className="text-overline text-muted-foreground block mb-0.5">Vara/Tribunal</span>{selectedProcess.court}</div>}
                {selectedProcess.judge && <div><span className="text-overline text-muted-foreground block mb-0.5">Juiz</span>{selectedProcess.judge}</div>}
              </div>
              {selectedProcess.notes && (
                <div>
                  <span className="text-overline text-muted-foreground block mb-1">Observações</span>
                  <p className="text-body-sm rounded-xl bg-muted p-3">{selectedProcess.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientPortal;
