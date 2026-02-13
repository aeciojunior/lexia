import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Button } from "@/components/ui/button";
import { RiskIndicator } from "@/components/lexia/LegalComponents";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Scale, FileText, Download, Eye, Shield, FolderOpen, CreditCard, DollarSign, Receipt, History, CheckCircle, Clock, ExternalLink, ScrollText, CalendarDays, PenTool, Gavel, MapPin, Video, ExternalLink as LinkIcon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import SignaturePad from "@/components/SignaturePad";
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
const invoiceStatusLabels: Record<string, string> = {
  draft: "Rascunho", pending: "Pendente", paid: "Pago", overdue: "Vencido", cancelled: "Cancelado",
};
const invoiceStatusVariant: Record<string, string> = {
  draft: "default", pending: "warning", paid: "success", overdue: "destructive", cancelled: "secondary",
};

const ClientPortal = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { isClient, isLoading: loadingPerms } = usePermissions();
  const queryClient = useQueryClient();
  const [selectedProcess, setSelectedProcess] = useState<any>(null);
  const [viewProcessDialog, setViewProcessDialog] = useState(false);
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [chargeInvoiceId, setChargeInvoiceId] = useState<string | null>(null);
  const [chargeMethod, setChargeMethod] = useState<"pix" | "boleto">("pix");
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [signContractId, setSignContractId] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const isPreviewMode = !loadingPerms && !isClient;

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

  // Fetch invoices (RLS: clients can see their own invoices)
  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["client-invoices", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId,
  });

  // Fetch payments history (RLS: clients can see their own payments)
  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["client-payments", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments" as any)
        .select("*, invoices(description, amount_cents)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId,
  });

  // Fetch contracts (RLS: clients can view own contracts)
  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ["client-contracts", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId,
  });

  // Fetch hearings (RLS: clients can view own process hearings)
  const { data: hearings = [], isLoading: loadingHearings } = useQuery({
    queryKey: ["client-hearings", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hearings")
        .select("*, processes(title, number)")
        .order("hearing_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  // Fetch existing signatures for contracts
  const { data: signatures = [] } = useQuery({
    queryKey: ["client-signatures", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_signatures" as any)
        .select("*")
        .order("signed_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId,
  });

  const signedContractIds = new Set(signatures.map((s: any) => s.contract_id));

  const signContractMutation = useMutation({
    mutationFn: async (signatureDataUrl: string) => {
      if (!signContractId || !user || !activeOrgId) throw new Error("Dados insuficientes");
      if (!acceptedTerms) throw new Error("Aceite os termos para continuar");

      // Convert data URL to blob and upload
      const res = await fetch(signatureDataUrl);
      const blob = await res.blob();
      const filePath = `${user.id}/${signContractId}-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("signatures")
        .upload(filePath, blob, { contentType: "image/png" });
      if (uploadError) throw uploadError;

      // Insert signature record
      const { error: insertError } = await (supabase.from("contract_signatures" as any) as any).insert({
        contract_id: signContractId,
        user_id: user.id,
        organization_id: activeOrgId,
        signature_url: filePath,
        ip_address: null, // would need a service to get real IP
        user_agent: navigator.userAgent,
        accepted_terms: true,
      });
      if (insertError) throw insertError;

      // Get the inserted signature id to send email
      const { data: insertedSig } = await (supabase.from("contract_signatures" as any) as any)
        .select("id")
        .eq("contract_id", signContractId)
        .eq("user_id", user.id)
        .order("signed_at", { ascending: false })
        .limit(1)
        .single();

      // Fire-and-forget email notification
      if (insertedSig?.id) {
        const { data: { session } } = await supabase.auth.getSession();
        fetch(`https://dnpakncqtzjdtkwcjpsw.supabase.co/functions/v1/send-signed-contract`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
            apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRucGFrbmNxdHpqZHRrd2NqcHN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTYzMjcsImV4cCI6MjA4NjQ3MjMyN30.BYLKOhlr-ekFWDQStd5ieSlUuhgypxRvgpO6L7gLc6U",
          },
          body: JSON.stringify({ signature_id: insertedSig.id }),
        }).catch(() => {}); // fire-and-forget
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-signatures"] });
      setSignDialogOpen(false);
      setSignContractId(null);
      setAcceptedTerms(false);
      toast.success("Contrato assinado com sucesso!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  const downloadContractPdf = async (contract: any, typeLabels: Record<string, string>, periodLabels: Record<string, string>, statusLabels: Record<string, string>) => {
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const w = pdf.internal.pageSize.getWidth();
    let y = 20;

    // Header
    pdf.setFillColor(26, 26, 46);
    pdf.rect(0, 0, w, 35, "F");
    pdf.setTextColor(224, 224, 255);
    pdf.setFontSize(18);
    pdf.text("Contrato", 15, 22);
    pdf.setFontSize(10);
    pdf.text(contract.title, 15, 30);
    y = 45;

    pdf.setTextColor(50, 50, 50);
    const addField = (label: string, value: string) => {
      if (y > 270) { pdf.addPage(); y = 20; }
      pdf.setFontSize(9);
      pdf.setTextColor(130, 130, 130);
      pdf.text(label, 15, y);
      pdf.setFontSize(11);
      pdf.setTextColor(50, 50, 50);
      pdf.text(value || "—", 15, y + 5);
      y += 14;
    };

    addField("Título", contract.title);
    addField("Tipo", typeLabels[contract.contract_type] || contract.contract_type);
    addField("Status", statusLabels[contract.status] || contract.status);
    addField("Valor", formatCurrency(contract.amount_cents) + (contract.periodicity ? ` / ${periodLabels[contract.periodicity] || contract.periodicity}` : ""));
    addField("Início", contract.start_date ? new Date(contract.start_date).toLocaleDateString("pt-BR") : "Não definido");
    addField("Término", contract.end_date ? new Date(contract.end_date).toLocaleDateString("pt-BR") : "Indeterminado");

    if (contract.description) {
      addField("Descrição", "");
      y -= 9;
      pdf.setFontSize(10);
      const lines = pdf.splitTextToSize(contract.description, w - 30);
      lines.forEach((line: string) => {
        if (y > 275) { pdf.addPage(); y = 20; }
        pdf.text(line, 15, y);
        y += 5;
      });
      y += 5;
    }

    if (contract.terms) {
      addField("Termos e Condições", "");
      y -= 9;
      pdf.setFontSize(10);
      const lines = pdf.splitTextToSize(contract.terms, w - 30);
      lines.forEach((line: string) => {
        if (y > 275) { pdf.addPage(); y = 20; }
        pdf.text(line, 15, y);
        y += 5;
      });
    }

    // Add signature if contract is signed
    const sig = signatures.find((s: any) => s.contract_id === contract.id);
    if (sig) {
      try {
        const { data: signedUrlData } = await supabase.storage.from("signatures").createSignedUrl(sig.signature_url, 60);
        if (signedUrlData?.signedUrl) {
          // Load image
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject();
            img.src = signedUrlData.signedUrl;
          });

          // Draw signature section
          if (y > 220) { pdf.addPage(); y = 20; }
          y += 10;
          pdf.setDrawColor(200, 200, 200);
          pdf.line(15, y, w - 15, y);
          y += 8;
          pdf.setFontSize(11);
          pdf.setTextColor(50, 50, 50);
          pdf.text("Assinatura Digital", 15, y);
          y += 6;

          // Add signature image
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          const imgData = canvas.toDataURL("image/png");
          const sigW = 60;
          const sigH = (img.naturalHeight / img.naturalWidth) * sigW;
          pdf.addImage(imgData, "PNG", 15, y, sigW, sigH);
          y += sigH + 5;

          pdf.setFontSize(8);
          pdf.setTextColor(130, 130, 130);
          pdf.text(`Assinado em ${new Date(sig.signed_at).toLocaleDateString("pt-BR")} às ${new Date(sig.signed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, 15, y);
          y += 4;
          if (sig.accepted_terms) {
            pdf.text("Termos aceitos digitalmente", 15, y);
          }
        }
      } catch (e) {
        console.error("Failed to load signature for PDF:", e);
      }
    }

    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(160, 160, 160);
    pdf.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} — Lexia`, 15, 285);

    pdf.save(`contrato-${contract.title.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    toast.success("PDF do contrato baixado!");
  };

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

  const createChargeMutation = useMutation({
    mutationFn: async () => {
      if (!chargeInvoiceId) throw new Error("Fatura não selecionada");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");
      const res = await fetch(
        `https://dnpakncqtzjdtkwcjpsw.supabase.co/functions/v1/pagseguro-charge`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRucGFrbmNxdHpqZHRrd2NqcHN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTYzMjcsImV4cCI6MjA4NjQ3MjMyN30.BYLKOhlr-ekFWDQStd5ieSlUuhgypxRvgpO6L7gLc6U",
          },
          body: JSON.stringify({ invoice_id: chargeInvoiceId, method: chargeMethod }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar cobrança");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["client-invoices"] });
      setChargeDialogOpen(false);
      setChargeInvoiceId(null);
      if (data.payment_link) {
        window.open(data.payment_link, "_blank");
        toast.success("Link de pagamento aberto!");
      } else {
        toast.success("Cobrança gerada com sucesso!");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (loadingPerms) return null;

  const pendingInvoices = invoices.filter((i: any) => i.status === "pending" || i.status === "overdue");
  const paidInvoices = invoices.filter((i: any) => i.status === "paid");
  const totalPending = pendingInvoices.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-5xl">
      {/* Preview mode banner */}
      {isPreviewMode && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 flex items-center gap-3">
          <Eye className="h-5 w-5 text-warning shrink-0" />
          <p className="text-sm text-warning">
            <span className="font-semibold">Modo Preview</span> — Você está visualizando o portal como um cliente veria. Os dados exibidos são da sua organização.
          </p>
        </motion.div>
      )}

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-overline text-primary mb-0.5">Portal do Cliente</p>
            <h1 className="text-display-lg">Meus Processos & Faturas</h1>
          </div>
        </div>
        <p className="text-body-sm text-muted-foreground mt-1">
          Acompanhe seus processos, documentos e efetue pagamentos
        </p>
      </motion.div>

      {/* Invoices Summary */}
      {invoices.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="h-4 w-4 text-warning" />
                <span className="text-overline text-muted-foreground">Pendente</span>
              </div>
              <p className="text-display-sm">{formatCurrency(totalPending)}</p>
              <p className="text-caption text-muted-foreground mt-1">{pendingInvoices.length} fatura{pendingInvoices.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-success" />
                <span className="text-overline text-muted-foreground">Pago</span>
              </div>
              <p className="text-display-sm">{formatCurrency(paidInvoices.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0))}</p>
              <p className="text-caption text-muted-foreground mt-1">{paidInvoices.length} fatura{paidInvoices.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-overline text-muted-foreground">Total de Faturas</span>
              </div>
              <p className="text-display-sm">{invoices.length}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Pending Invoices with Pay Button */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <LexCard hover={false}>
          <Tabs defaultValue="invoices">
            <LexCardHeader>
              <div className="flex items-center justify-between w-full">
                <LexCardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" /> Financeiro
                </LexCardTitle>
                <TabsList>
                  <TabsTrigger value="invoices" className="gap-1.5"><Receipt className="h-3.5 w-3.5" /> Faturas</TabsTrigger>
                  <TabsTrigger value="payments" className="gap-1.5"><History className="h-3.5 w-3.5" /> Pagamentos</TabsTrigger>
                  <TabsTrigger value="contracts" className="gap-1.5"><ScrollText className="h-3.5 w-3.5" /> Contratos</TabsTrigger>
                </TabsList>
              </div>
            </LexCardHeader>

            {/* Invoices Tab */}
            <TabsContent value="invoices">
              {loadingInvoices ? (
                <div className="py-12 text-center">
                  <div className="flex gap-1.5 justify-center mb-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse-glow" />
                    <span className="h-2.5 w-2.5 rounded-full bg-secondary animate-pulse-glow" style={{ animationDelay: "200ms" }} />
                  </div>
                </div>
              ) : invoices.length === 0 ? (
                <div className="py-12 text-center">
                  <CreditCard className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-body-sm text-muted-foreground">Nenhuma fatura encontrada.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {invoices.map((inv: any, i: number) => {
                    const canPay = inv.status === "pending" || inv.status === "overdue";
                    const hasPayLink = inv.metadata?.pagseguro_payment_link;
                    return (
                      <motion.div
                        key={inv.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl border shrink-0 ${
                            inv.status === "paid" ? "bg-success/10 border-success/20" : "bg-warning/10 border-warning/20"
                          }`}>
                            {inv.status === "paid" ? (
                              <DollarSign className="h-5 w-5 text-success" />
                            ) : (
                              <Receipt className="h-5 w-5 text-warning" />
                            )}
                          </div>
                          <div>
                            <p className="text-body-sm font-medium">{inv.description || "Sem descrição"}</p>
                            <p className="text-caption text-muted-foreground">
                              {formatCurrency(inv.amount_cents)}
                              {inv.due_date && ` • Vence: ${new Date(inv.due_date).toLocaleDateString("pt-BR")}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <LexBadge variant={invoiceStatusVariant[inv.status] as any || "default"}>
                            {invoiceStatusLabels[inv.status] || inv.status}
                          </LexBadge>
                          {canPay && (
                            hasPayLink ? (
                              <Button
                                size="sm"
                                variant="default"
                                className="gap-1.5"
                                onClick={() => window.open(inv.metadata.pagseguro_payment_link, "_blank")}
                              >
                                <CreditCard className="h-3.5 w-3.5" /> Pagar
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => { setChargeInvoiceId(inv.id); setChargeDialogOpen(true); }}
                              >
                                <CreditCard className="h-3.5 w-3.5" /> Gerar Pagamento
                              </Button>
                            )
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Payments History Tab */}
            <TabsContent value="payments">
              {loadingPayments ? (
                <div className="py-12 text-center">
                  <div className="flex gap-1.5 justify-center mb-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse-glow" />
                    <span className="h-2.5 w-2.5 rounded-full bg-secondary animate-pulse-glow" style={{ animationDelay: "200ms" }} />
                  </div>
                </div>
              ) : payments.length === 0 ? (
                <div className="py-12 text-center">
                  <History className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-body-sm text-muted-foreground">Nenhum pagamento registrado.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payments.map((pay: any, i: number) => {
                    const isPaid = pay.status === "paid" || pay.status === "confirmed";
                    const methodLabels: Record<string, string> = { pix: "PIX", boleto: "Boleto", credit_card: "Cartão", other: "Outro" };
                    const paymentStatusLabels: Record<string, string> = { pending: "Pendente", paid: "Confirmado", confirmed: "Confirmado", failed: "Falhou", refunded: "Estornado" };
                    const paymentStatusVariant: Record<string, string> = { pending: "warning", paid: "success", confirmed: "success", failed: "destructive", refunded: "secondary" };
                    return (
                      <motion.div
                        key={pay.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl border shrink-0 ${
                            isPaid ? "bg-success/10 border-success/20" : "bg-muted border-border"
                          }`}>
                            {isPaid ? (
                              <CheckCircle className="h-5 w-5 text-success" />
                            ) : (
                              <Clock className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="text-body-sm font-medium">
                              {formatCurrency(pay.amount_cents)}
                              <span className="ml-2 text-caption text-muted-foreground">
                                via {methodLabels[pay.method] || pay.method}
                              </span>
                            </p>
                            <p className="text-caption text-muted-foreground">
                              {pay.invoices?.description || "Pagamento avulso"}
                              {" • "}
                              {pay.paid_at
                                ? `Pago em ${new Date(pay.paid_at).toLocaleDateString("pt-BR")}`
                                : `Criado em ${new Date(pay.created_at).toLocaleDateString("pt-BR")}`
                              }
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <LexBadge variant={paymentStatusVariant[pay.status] as any || "default"}>
                            {paymentStatusLabels[pay.status] || pay.status}
                          </LexBadge>
                          {pay.external_id && (
                            <span className="text-caption font-mono text-muted-foreground" title="ID PagSeguro">
                              #{pay.external_id.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Contracts Tab */}
            <TabsContent value="contracts">
              {loadingContracts ? (
                <div className="py-12 text-center">
                  <div className="flex gap-1.5 justify-center mb-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse-glow" />
                    <span className="h-2.5 w-2.5 rounded-full bg-secondary animate-pulse-glow" style={{ animationDelay: "200ms" }} />
                  </div>
                </div>
              ) : contracts.length === 0 ? (
                <div className="py-12 text-center">
                  <ScrollText className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-body-sm text-muted-foreground">Nenhum contrato encontrado.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {contracts.map((c: any, i: number) => {
                    const contractStatusLabels: Record<string, string> = { active: "Ativo", draft: "Rascunho", expired: "Expirado", cancelled: "Cancelado", suspended: "Suspenso" };
                    const contractStatusVariant: Record<string, string> = { active: "success", draft: "default", expired: "warning", cancelled: "destructive", suspended: "secondary" };
                    const contractTypeLabels: Record<string, string> = { service: "Serviço", retainer: "Honorário Fixo", hourly: "Por Hora", contingency: "Êxito", other: "Outro" };
                    const periodicityLabels: Record<string, string> = { monthly: "Mensal", quarterly: "Trimestral", yearly: "Anual", once: "Único" };
                    return (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl border shrink-0 ${
                            c.status === "active" ? "bg-success/10 border-success/20" : "bg-muted border-border"
                          }`}>
                            <ScrollText className={`h-5 w-5 ${c.status === "active" ? "text-success" : "text-muted-foreground"}`} />
                          </div>
                          <div>
                            <p className="text-body-sm font-medium">{c.title}</p>
                            <p className="text-caption text-muted-foreground">
                              {contractTypeLabels[c.contract_type] || c.contract_type}
                              {" • "}
                              {formatCurrency(c.amount_cents)}
                              {c.periodicity && ` / ${periodicityLabels[c.periodicity] || c.periodicity}`}
                            </p>
                            {(c.start_date || c.end_date) && (
                              <p className="text-caption text-muted-foreground flex items-center gap-1 mt-0.5">
                                <CalendarDays className="h-3 w-3" />
                                {c.start_date ? new Date(c.start_date).toLocaleDateString("pt-BR") : "—"}
                                {" → "}
                                {c.end_date ? new Date(c.end_date).toLocaleDateString("pt-BR") : "Indeterminado"}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {signedContractIds.has(c.id) ? (
                            <LexBadge variant="success">
                              <CheckCircle className="h-3 w-3 mr-1" /> Assinado
                            </LexBadge>
                          ) : (
                            <Button
                              size="sm"
                              variant="default"
                              className="gap-1.5"
                              onClick={(e) => { e.stopPropagation(); setSignContractId(c.id); setAcceptedTerms(false); setSignDialogOpen(true); }}
                            >
                              <PenTool className="h-3.5 w-3.5" /> Assinar
                            </Button>
                          )}
                          <LexBadge variant={contractStatusVariant[c.status] as any || "default"}>
                            {contractStatusLabels[c.status] || c.status}
                          </LexBadge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5"
                            onClick={(e) => { e.stopPropagation(); downloadContractPdf(c, contractTypeLabels, periodicityLabels, contractStatusLabels); }}
                          >
                            <Download className="h-3.5 w-3.5" /> PDF
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </LexCard>
      </motion.div>

      {/* Processes */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
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

      {/* Hearings */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
        <LexCard hover={false}>
          <LexCardHeader>
            <LexCardTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-primary" /> Audiências ({hearings.length})
            </LexCardTitle>
          </LexCardHeader>

          {loadingHearings ? (
            <div className="py-12 text-center">
              <div className="flex gap-1.5 justify-center mb-3">
                <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse-glow" />
                <span className="h-2.5 w-2.5 rounded-full bg-secondary animate-pulse-glow" style={{ animationDelay: "200ms" }} />
              </div>
            </div>
          ) : hearings.length === 0 ? (
            <div className="py-12 text-center">
              <Gavel className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-body-sm text-muted-foreground">Nenhuma audiência agendada.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {hearings.map((h: any, i: number) => {
                const hearingTypeLabels: Record<string, string> = { initial: "Inicial", conciliation: "Conciliação", instruction: "Instrução", judgment: "Julgamento", other: "Outra" };
                const hearingStatusLabels: Record<string, string> = { scheduled: "Agendada", completed: "Realizada", cancelled: "Cancelada", postponed: "Adiada" };
                const hearingStatusVariant: Record<string, string> = { scheduled: "warning", completed: "success", cancelled: "destructive", postponed: "secondary" };
                const date = new Date(h.hearing_date);
                const isPast = date < new Date();
                return (
                  <motion.div
                    key={h.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl border shrink-0 ${
                        h.status === "completed" ? "bg-success/10 border-success/20" :
                        h.status === "cancelled" ? "bg-destructive/10 border-destructive/20" :
                        "bg-warning/10 border-warning/20"
                      }`}>
                        <Gavel className={`h-5 w-5 ${
                          h.status === "completed" ? "text-success" :
                          h.status === "cancelled" ? "text-destructive" :
                          "text-warning"
                        }`} />
                      </div>
                      <div>
                        <p className="text-body-sm font-medium">
                          {hearingTypeLabels[h.hearing_type] || h.hearing_type}
                          {h.processes && <span className="text-muted-foreground"> — <span className="font-mono text-primary">{h.processes.number}</span></span>}
                        </p>
                        <p className="text-caption text-muted-foreground flex items-center gap-1.5">
                          <CalendarDays className="h-3 w-3" />
                          {date.toLocaleDateString("pt-BR")} às {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          <span className="mx-1">•</span>
                          <MapPin className="h-3 w-3" />
                          {h.location}
                        </p>
                        {h.video_link && (
                          <a
                            href={h.video_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-caption text-primary flex items-center gap-1 mt-0.5 hover:underline"
                          >
                            <Video className="h-3 w-3" /> Link da videoconferência
                          </a>
                        )}
                      </div>
                    </div>
                    <LexBadge variant={hearingStatusVariant[h.status] as any || "default"}>
                      {hearingStatusLabels[h.status] || h.status}
                    </LexBadge>
                  </motion.div>
                );
              })}
            </div>
          )}
        </LexCard>
      </motion.div>

      {/* Documents */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
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

      {/* Payment Method Dialog */}
      <Dialog open={chargeDialogOpen} onOpenChange={setChargeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-success" /> Efetuar Pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-body-sm text-muted-foreground">Escolha o método de pagamento:</p>
            <Select value={chargeMethod} onValueChange={(v: any) => setChargeMethod(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="boleto">Boleto Bancário</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChargeDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => createChargeMutation.mutate()} disabled={createChargeMutation.isPending} className="gap-2">
              {createChargeMutation.isPending ? "Gerando..." : "Gerar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signature Dialog */}
      <Dialog open={signDialogOpen} onOpenChange={(open) => { setSignDialogOpen(open); if (!open) { setAcceptedTerms(false); setSignContractId(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5 text-primary" /> Assinar Contrato
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {signContractId && (() => {
              const contract = contracts.find((c: any) => c.id === signContractId);
              return contract ? (
                <div className="rounded-xl bg-muted/50 p-4 space-y-1">
                  <p className="text-body-sm font-medium">{contract.title}</p>
                  <p className="text-caption text-muted-foreground">{formatCurrency(contract.amount_cents)}</p>
                  {contract.terms && (
                    <div className="mt-3 max-h-32 overflow-y-auto rounded-lg bg-background p-3 border border-border">
                      <p className="text-caption text-muted-foreground whitespace-pre-wrap">{contract.terms}</p>
                    </div>
                  )}
                </div>
              ) : null;
            })()}

            <SignaturePad
              onSign={(dataUrl) => signContractMutation.mutate(dataUrl)}
              disabled={!acceptedTerms || signContractMutation.isPending}
            />

            <div className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/30">
              <Checkbox
                id="accept-terms"
                checked={acceptedTerms}
                onCheckedChange={(v) => setAcceptedTerms(v === true)}
                disabled={signContractMutation.isPending}
              />
              <label htmlFor="accept-terms" className="text-caption leading-tight cursor-pointer">
                Li e aceito os termos e condições deste contrato. Declaro que esta assinatura digital tem validade jurídica conforme a legislação vigente.
              </label>
            </div>

            {signContractMutation.isPending && (
              <p className="text-caption text-muted-foreground text-center animate-pulse">Salvando assinatura...</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientPortal;
