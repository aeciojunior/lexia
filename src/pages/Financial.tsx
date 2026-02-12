import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DollarSign, FileText, CreditCard, TrendingUp, Search, Lock, Plus, ScrollText, BarChart3, Users, Pencil, Trash2, ChevronLeft, ChevronRight, Download, ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, Target, Percent, Receipt, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { format, subMonths, startOfMonth, endOfMonth, addDays, differenceInDays, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const statusColors: Record<string, string> = {
  draft: "default", pending: "warning", paid: "success", overdue: "destructive",
  cancelled: "secondary", confirmed: "success", failed: "destructive", refunded: "warning",
  active: "success", suspended: "warning", completed: "default",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho", pending: "Pendente", paid: "Pago", overdue: "Vencido",
  cancelled: "Cancelado", confirmed: "Confirmado", failed: "Falhou", refunded: "Reembolsado",
  active: "Ativo", suspended: "Suspenso", completed: "Concluído",
};

const methodLabels: Record<string, string> = { pix: "PIX", boleto: "Boleto", credit_card: "Cartão", transfer: "Transferência", other: "Outro" };
const contractTypeLabels: Record<string, string> = { service: "Serviço", contingency: "Êxito", fixed: "Fixo", hourly: "Hora", other: "Outro" };
const periodicityLabels: Record<string, string> = { once: "Único", monthly: "Mensal", quarterly: "Trimestral", yearly: "Anual" };

const ITEMS_PER_PAGE = 10;

const Financial = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const { isFree } = usePlanLimits();
  const queryClient = useQueryClient();
  const [invoiceStatus, setInvoiceStatus] = useState<string>("all");
  const [paymentStatus, setPaymentStatus] = useState<string>("all");
  const [invoiceClientFilter, setInvoiceClientFilter] = useState<string>("all");
  const [contractClientFilter, setContractClientFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [newInvoice, setNewInvoice] = useState({ description: "", amount: "", due_date: "", status: "draft", client_id: "none" });
  const [newContract, setNewContract] = useState({ title: "", description: "", contract_type: "service", amount: "", periodicity: "monthly", start_date: "", end_date: "", status: "active", terms: "", client_id: "none" });
  const [deleteTarget, setDeleteTarget] = useState<{ type: "invoice" | "contract"; id: string; label: string } | null>(null);
  const [invoicePage, setInvoicePage] = useState(0);
  const [contractPage, setContractPage] = useState(0);
  const [paymentPage, setPaymentPage] = useState(0);

  const canViewFinancial = hasPermission("VIEW_FINANCIAL");
  const canManageFinancial = hasPermission("MANAGE_FINANCIAL");

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", activeOrgId, invoiceStatus],
    queryFn: async () => {
      let query = supabase.from("invoices" as any).select("*").eq("organization_id", activeOrgId!).order("created_at", { ascending: false });
      if (invoiceStatus !== "all") query = query.eq("status", invoiceStatus);
      const { data, error } = await query;
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId && canViewFinancial,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments", activeOrgId, paymentStatus],
    queryFn: async () => {
      let query = supabase.from("payments" as any).select("*").eq("organization_id", activeOrgId!).order("created_at", { ascending: false });
      if (paymentStatus !== "all") query = query.eq("status", paymentStatus);
      const { data, error } = await query;
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId && canViewFinancial,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts" as any).select("*").eq("organization_id", activeOrgId!).order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!activeOrgId && canViewFinancial,
  });

  // Fetch clients
  const { data: orgClients = [] } = useQuery({
    queryKey: ["org-clients-financial", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name")
        .eq("organization_id", activeOrgId!)
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return (data || []) as { id: string; full_name: string }[];
    },
    enabled: !!activeOrgId && canViewFinancial,
  });

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  const totalPending = invoices.filter((i: any) => i.status === "pending").reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
  const totalPaid = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
  const totalOverdue = invoices.filter((i: any) => i.status === "overdue").reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
  const totalContracts = contracts.reduce((s: number, c: any) => s + (c.amount_cents || 0), 0);

  const kpis = [
    { label: "Pendente", value: formatCurrency(totalPending), icon: FileText, variant: "warning" },
    { label: "Recebido", value: formatCurrency(totalPaid), icon: TrendingUp, variant: "success" },
    { label: "Vencido", value: formatCurrency(totalOverdue), icon: DollarSign, variant: "destructive" },
    { label: "Contratos", value: `${contracts.length} (${formatCurrency(totalContracts)})`, icon: ScrollText, variant: "primary" },
  ];

  const filteredInvoices = invoices.filter((i: any) => {
    if (search && !i.description?.toLowerCase().includes(search.toLowerCase())) return false;
    if (invoiceClientFilter !== "all" && (i.client_id || "none") !== invoiceClientFilter) return false;
    return true;
  });
  const filteredContracts = contracts.filter((c: any) => {
    if (search && !c.title?.toLowerCase().includes(search.toLowerCase())) return false;
    if (contractClientFilter !== "all" && (c.client_id || "none") !== contractClientFilter) return false;
    return true;
  });
  const filteredPayments = payments.filter((p: any) => !search || p.external_id?.toLowerCase().includes(search.toLowerCase()));

  // Revenue by month chart data
  const revenueByMonth = useMemo(() => {
    const months: { name: string; receita: number; month: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const total = invoices
        .filter((inv: any) => inv.status === "paid" && new Date(inv.created_at) >= start && new Date(inv.created_at) <= end)
        .reduce((s: number, inv: any) => s + (inv.amount_cents || 0), 0);
      months.push({ name: format(d, "MMM yy", { locale: ptBR }), receita: total / 100, month: d });
    }
    return months;
  }, [invoices]);

  // Revenue by client chart data
  const revenueByClient = useMemo(() => {
    const map = new Map<string, number>();
    invoices
      .filter((inv: any) => inv.status === "paid")
      .forEach((inv: any) => {
        const clientId = inv.client_id || "__no_client__";
        map.set(clientId, (map.get(clientId) || 0) + (inv.amount_cents || 0));
      });
    const result = Array.from(map.entries()).map(([clientId, total]) => {
      const client = orgClients.find(c => c.id === clientId);
      return { name: client?.full_name || "Sem cliente", value: total / 100 };
    }).sort((a, b) => b.value - a.value).slice(0, 8);
    return result;
  }, [invoices, orgClients]);

  const CHART_COLORS = [
    "hsl(192, 95%, 55%)", "hsl(270, 80%, 62%)", "hsl(160, 85%, 45%)", 
    "hsl(40, 95%, 55%)", "hsl(0, 85%, 55%)", "hsl(210, 80%, 60%)",
    "hsl(320, 70%, 55%)", "hsl(130, 60%, 50%)",
  ];

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      const amountCents = Math.round(parseFloat(newInvoice.amount.replace(",", ".")) * 100);
      if (isNaN(amountCents) || amountCents <= 0) throw new Error("Valor inválido");
      const { error } = await supabase.from("invoices" as any).insert({
        organization_id: activeOrgId, user_id: user!.id,
        description: newInvoice.description, amount_cents: amountCents,
        due_date: newInvoice.due_date || null, status: newInvoice.status,
        client_id: newInvoice.client_id === "none" ? null : newInvoice.client_id,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "billing_generated", user_id: user!.id, organization_id: activeOrgId, resource_type: "invoice", metadata: { amount_cents: amountCents } } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setCreateDialogOpen(false);
      setNewInvoice({ description: "", amount: "", due_date: "", status: "draft", client_id: "none" });
      toast.success("Fatura criada com sucesso!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createContractMutation = useMutation({
    mutationFn: async () => {
      const amountCents = Math.round(parseFloat(newContract.amount.replace(",", ".")) * 100);
      if (isNaN(amountCents) || amountCents < 0) throw new Error("Valor inválido");
      const { error } = await supabase.from("contracts" as any).insert({
        organization_id: activeOrgId, user_id: user!.id,
        title: newContract.title, description: newContract.description || null,
        contract_type: newContract.contract_type, amount_cents: amountCents,
        periodicity: newContract.periodicity,
        start_date: newContract.start_date || null, end_date: newContract.end_date || null,
        status: newContract.status, terms: newContract.terms || null,
        client_id: newContract.client_id === "none" ? null : newContract.client_id,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "contract_created", user_id: user!.id, organization_id: activeOrgId, resource_type: "contract", metadata: { title: newContract.title, amount_cents: amountCents } } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setContractDialogOpen(false);
      setNewContract({ title: "", description: "", contract_type: "service", amount: "", periodicity: "monthly", start_date: "", end_date: "", status: "active", terms: "", client_id: "none" });
      toast.success("Contrato criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!editingInvoiceId) throw new Error("Nenhuma fatura selecionada");
      const amountCents = Math.round(parseFloat(newInvoice.amount.replace(",", ".")) * 100);
      if (isNaN(amountCents) || amountCents <= 0) throw new Error("Valor inválido");
      const { error } = await supabase.from("invoices" as any).update({
        description: newInvoice.description, amount_cents: amountCents,
        due_date: newInvoice.due_date || null, status: newInvoice.status,
        client_id: newInvoice.client_id === "none" ? null : newInvoice.client_id,
      }).eq("id", editingInvoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setCreateDialogOpen(false);
      setEditingInvoiceId(null);
      setNewInvoice({ description: "", amount: "", due_date: "", status: "draft", client_id: "none" });
      toast.success("Fatura atualizada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateContractMutation = useMutation({
    mutationFn: async () => {
      if (!editingContractId) throw new Error("Nenhum contrato selecionado");
      const amountCents = Math.round(parseFloat(newContract.amount.replace(",", ".")) * 100);
      if (isNaN(amountCents) || amountCents < 0) throw new Error("Valor inválido");
      const { error } = await supabase.from("contracts" as any).update({
        title: newContract.title, description: newContract.description || null,
        contract_type: newContract.contract_type, amount_cents: amountCents,
        periodicity: newContract.periodicity,
        start_date: newContract.start_date || null, end_date: newContract.end_date || null,
        status: newContract.status, terms: newContract.terms || null,
        client_id: newContract.client_id === "none" ? null : newContract.client_id,
      }).eq("id", editingContractId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setContractDialogOpen(false);
      setEditingContractId(null);
      setNewContract({ title: "", description: "", contract_type: "service", amount: "", periodicity: "monthly", start_date: "", end_date: "", status: "active", terms: "", client_id: "none" });
      toast.success("Contrato atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEditInvoice = (inv: any) => {
    setEditingInvoiceId(inv.id);
    setNewInvoice({
      description: inv.description || "", amount: (inv.amount_cents / 100).toFixed(2).replace(".", ","),
      due_date: inv.due_date || "", status: inv.status, client_id: inv.client_id || "none",
    });
    setCreateDialogOpen(true);
  };

  const openEditContract = (c: any) => {
    setEditingContractId(c.id);
    setNewContract({
      title: c.title || "", description: c.description || "", contract_type: c.contract_type || "service",
      amount: (c.amount_cents / 100).toFixed(2).replace(".", ","), periodicity: c.periodicity || "monthly",
      start_date: c.start_date || "", end_date: c.end_date || "", status: c.status || "active",
      terms: c.terms || "", client_id: c.client_id || "none",
    });
    setContractDialogOpen(true);
  };

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Fatura excluída!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteContractMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contracts" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["contracts"] }); toast.success("Contrato excluído!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "invoice") deleteInvoiceMutation.mutate(deleteTarget.id);
    else deleteContractMutation.mutate(deleteTarget.id);
    setDeleteTarget(null);
  };

  // Pagination helpers
  const paginatedInvoices = filteredInvoices.slice(invoicePage * ITEMS_PER_PAGE, (invoicePage + 1) * ITEMS_PER_PAGE);
  const invoiceTotalPages = Math.max(1, Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE));
  const paginatedContracts = filteredContracts.slice(contractPage * ITEMS_PER_PAGE, (contractPage + 1) * ITEMS_PER_PAGE);
  const contractTotalPages = Math.max(1, Math.ceil(filteredContracts.length / ITEMS_PER_PAGE));
  const paginatedPayments = filteredPayments.slice(paymentPage * ITEMS_PER_PAGE, (paymentPage + 1) * ITEMS_PER_PAGE);
  const paymentTotalPages = Math.max(1, Math.ceil(filteredPayments.length / ITEMS_PER_PAGE));

  // Monthly summary with comparison
  const monthlySummary = useMemo(() => {
    const now = new Date();
    const curStart = startOfMonth(now);
    const curEnd = endOfMonth(now);
    const prevStart = startOfMonth(subMonths(now, 1));
    const prevEnd = endOfMonth(subMonths(now, 1));

    const inRange = (dateStr: string, start: Date, end: Date) => {
      const d = new Date(dateStr);
      return d >= start && d <= end;
    };

    const curInvoices = invoices.filter((i: any) => inRange(i.created_at, curStart, curEnd));
    const prevInvoices = invoices.filter((i: any) => inRange(i.created_at, prevStart, prevEnd));

    const curPaidTotal = curInvoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
    const prevPaidTotal = prevInvoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);

    const curPendingTotal = curInvoices.filter((i: any) => i.status === "pending").reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
    const prevPendingTotal = prevInvoices.filter((i: any) => i.status === "pending").reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);

    const curOverdueTotal = curInvoices.filter((i: any) => i.status === "overdue").reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
    const prevOverdueTotal = prevInvoices.filter((i: any) => i.status === "overdue").reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);

    const curNewCount = curInvoices.length;
    const prevNewCount = prevInvoices.length;

    const delta = (cur: number, prev: number) => prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;

    return {
      curMonth: format(now, "MMMM yyyy", { locale: ptBR }),
      prevMonth: format(subMonths(now, 1), "MMMM yyyy", { locale: ptBR }),
      items: [
        { label: "Receita", cur: curPaidTotal, prev: prevPaidTotal, delta: delta(curPaidTotal, prevPaidTotal) },
        { label: "Pendente", cur: curPendingTotal, prev: prevPendingTotal, delta: delta(curPendingTotal, prevPendingTotal) },
        { label: "Vencido", cur: curOverdueTotal, prev: prevOverdueTotal, delta: delta(curOverdueTotal, prevOverdueTotal) },
        { label: "Novas faturas", cur: curNewCount, prev: prevNewCount, delta: delta(curNewCount, prevNewCount), isCount: true },
      ],
    };
  }, [invoices]);

  // Invoices due within 7 days
  const dueSoonInvoices = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7Days = addDays(today, 7);
    return invoices.filter((inv: any) => {
      if (!inv.due_date || inv.status === "paid" || inv.status === "cancelled") return false;
      const due = new Date(inv.due_date);
      due.setHours(0, 0, 0, 0);
      return due >= today && due <= in7Days;
    });
  }, [invoices]);

  // Executive dashboard indicators
  const executiveDashboard = useMemo(() => {
    const paidInvoices = invoices.filter((i: any) => i.status === "paid");
    const overdueInvoices = invoices.filter((i: any) => i.status === "overdue");
    const pendingInvoices = invoices.filter((i: any) => i.status === "pending");

    const totalBilled = invoices.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
    const totalCollected = paidInvoices.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
    const totalOverdueAmt = overdueInvoices.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);

    const defaultRate = totalBilled > 0 ? (totalOverdueAmt / totalBilled) * 100 : 0;
    const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;
    const avgTicket = paidInvoices.length > 0 ? totalCollected / paidInvoices.length : 0;

    const activeContracts = contracts.filter((c: any) => c.status === "active");
    const activeContractsValue = activeContracts.reduce((s: number, c: any) => s + (c.amount_cents || 0), 0);

    const paidWithDates = paidInvoices.filter((i: any) => i.due_date && i.paid_at);
    const avgDaysToReceive = paidWithDates.length > 0
      ? paidWithDates.reduce((s: number, i: any) => s + differenceInDays(new Date(i.paid_at), new Date(i.due_date)), 0) / paidWithDates.length
      : null;

    return {
      defaultRate, collectionRate, avgTicket,
      activeContractsCount: activeContracts.length, activeContractsValue,
      avgDaysToReceive,
      pendingCount: pendingInvoices.length + overdueInvoices.length,
      totalBilled, totalCollected, totalOverdueAmt,
    };
  }, [invoices, contracts]);

  // CSV export helpers
  const downloadCSV = (filename: string, headers: string[], rows: string[][]) => {
    const bom = "\uFEFF";
    const csv = bom + [headers.join(";"), ...rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filename} exportado!`);
  };

  const exportInvoicesCSV = () => {
    const headers = ["Descrição", "Cliente", "Valor (R$)", "Status", "Vencimento", "Criado em"];
    const rows = filteredInvoices.map((inv: any) => [
      inv.description || "",
      orgClients.find(c => c.id === inv.client_id)?.full_name || "",
      (inv.amount_cents / 100).toFixed(2).replace(".", ","),
      statusLabels[inv.status] || inv.status,
      inv.due_date || "",
      format(new Date(inv.created_at), "dd/MM/yyyy"),
    ]);
    downloadCSV("faturas.csv", headers, rows);
  };

  const exportContractsCSV = () => {
    const headers = ["Título", "Cliente", "Tipo", "Valor (R$)", "Periodicidade", "Status", "Início", "Fim"];
    const rows = filteredContracts.map((c: any) => [
      c.title,
      orgClients.find(cl => cl.id === c.client_id)?.full_name || "",
      contractTypeLabels[c.contract_type] || c.contract_type,
      (c.amount_cents / 100).toFixed(2).replace(".", ","),
      periodicityLabels[c.periodicity] || c.periodicity,
      statusLabels[c.status] || c.status,
      c.start_date || "",
      c.end_date || "",
    ]);
    downloadCSV("contratos.csv", headers, rows);
  };

  const exportPaymentsCSV = () => {
    const headers = ["Valor (R$)", "Método", "Status", "Data", "ID Externo"];
    const rows = filteredPayments.map((p: any) => [
      (p.amount_cents / 100).toFixed(2).replace(".", ","),
      methodLabels[p.method] || p.method,
      statusLabels[p.status] || p.status,
      format(new Date(p.created_at), "dd/MM/yyyy"),
      p.external_id || "",
    ]);
    downloadCSV("pagamentos.csv", headers, rows);
  };

  if (!canViewFinancial) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Lock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-display-sm text-muted-foreground">Acesso restrito</h2>
          <p className="text-body-sm text-muted-foreground/60 mt-2">Você não tem permissão para acessar o módulo financeiro.</p>
        </div>
      </div>
    );
  }

  if (isFree) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-secondary/20 to-primary/20 border border-secondary/20 flex items-center justify-center mx-auto mb-4">
            <DollarSign className="h-8 w-8 text-secondary" />
          </div>
          <h2 className="text-display-sm">Módulo Financeiro</h2>
          <p className="text-body-sm text-muted-foreground mt-2 mb-6">
            O módulo financeiro está disponível nos planos <strong>Profissional</strong> e <strong>Enterprise</strong>.
          </p>
          <Button variant="ai">Fazer upgrade</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-overline text-primary mb-1">Financeiro</p>
        <h1 className="text-display-lg">Gestão Financeira</h1>
        <p className="text-body-sm text-muted-foreground mt-1">Faturas, pagamentos, contratos e controle financeiro</p>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <kpi.icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-overline text-muted-foreground">{kpi.label}</span>
              </div>
              <p className="text-display-sm">{kpi.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Monthly Summary with Comparison */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <LexCard hover={false}>
          <LexCardHeader>
            <LexCardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Resumo Mensal — <span className="capitalize">{monthlySummary.curMonth}</span>
            </LexCardTitle>
            <span className="text-caption text-muted-foreground">vs <span className="capitalize">{monthlySummary.prevMonth}</span></span>
          </LexCardHeader>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {monthlySummary.items.map((item) => {
              const isPositive = item.label === "Vencido" ? item.delta < 0 : item.delta > 0;
              const isNeutral = item.delta === 0;
              return (
                <div key={item.label} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-overline text-muted-foreground mb-1">{item.label}</p>
                  <p className="text-display-sm">
                    {item.isCount ? item.cur : formatCurrency(item.cur)}
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    {isNeutral ? (
                      <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : isPositive ? (
                      <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                    )}
                    <span className={`text-caption font-medium ${isNeutral ? "text-muted-foreground" : isPositive ? "text-success" : "text-destructive"}`}>
                      {Math.abs(item.delta).toFixed(0)}%
                    </span>
                    <span className="text-caption text-muted-foreground ml-1">
                      {item.isCount ? `(${item.prev})` : `(${formatCurrency(item.prev)})`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </LexCard>
      </motion.div>

      {/* Due Soon Alerts */}
      {dueSoonInvoices.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4.5 w-4.5 text-warning" />
              <h3 className="text-body-sm font-semibold text-warning">
                {dueSoonInvoices.length} fatura{dueSoonInvoices.length > 1 ? "s" : ""} vence{dueSoonInvoices.length > 1 ? "m" : ""} nos próximos 7 dias
              </h3>
            </div>
            <div className="space-y-2">
              {dueSoonInvoices.slice(0, 5).map((inv: any) => {
                const daysLeft = differenceInDays(new Date(inv.due_date), new Date());
                return (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                      <span className="text-body-sm font-medium">{inv.description || "Sem descrição"}</span>
                      {orgClients.find(c => c.id === inv.client_id) && (
                        <span className="text-caption text-muted-foreground">• {orgClients.find(c => c.id === inv.client_id)?.full_name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-body-sm text-primary">{formatCurrency(inv.amount_cents)}</span>
                      <LexBadge variant={daysLeft <= 2 ? "destructive" : "warning"}>
                        {daysLeft === 0 ? "Vence hoje" : `${daysLeft} dia${daysLeft > 1 ? "s" : ""}`}
                      </LexBadge>
                    </div>
                  </div>
                );
              })}
              {dueSoonInvoices.length > 5 && (
                <p className="text-caption text-muted-foreground text-center pt-1">
                  + {dueSoonInvoices.length - 5} fatura{dueSoonInvoices.length - 5 > 1 ? "s" : ""} a vencer
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Executive Financial Dashboard */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <LexCard hover={false}>
          <LexCardHeader>
            <LexCardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Painel Executivo — Saúde Financeira
            </LexCardTitle>
          </LexCardHeader>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Default Rate */}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className={`h-4 w-4 ${executiveDashboard.defaultRate > 20 ? "text-destructive" : executiveDashboard.defaultRate > 10 ? "text-warning" : "text-success"}`} />
                <p className="text-overline text-muted-foreground">Inadimplência</p>
              </div>
              <p className="text-display-sm">{executiveDashboard.defaultRate.toFixed(1)}%</p>
              <p className="text-caption text-muted-foreground mt-1">{formatCurrency(executiveDashboard.totalOverdueAmt)} vencido</p>
            </div>

            {/* Collection Rate */}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Percent className={`h-4 w-4 ${executiveDashboard.collectionRate >= 80 ? "text-success" : executiveDashboard.collectionRate >= 50 ? "text-warning" : "text-destructive"}`} />
                <p className="text-overline text-muted-foreground">Taxa de Recebimento</p>
              </div>
              <p className="text-display-sm">{executiveDashboard.collectionRate.toFixed(1)}%</p>
              <p className="text-caption text-muted-foreground mt-1">{formatCurrency(executiveDashboard.totalCollected)} de {formatCurrency(executiveDashboard.totalBilled)}</p>
            </div>

            {/* Average Ticket */}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-primary" />
                <p className="text-overline text-muted-foreground">Ticket Médio</p>
              </div>
              <p className="text-display-sm">{formatCurrency(executiveDashboard.avgTicket)}</p>
              <p className="text-caption text-muted-foreground mt-1">por fatura paga</p>
            </div>

            {/* Active Contracts */}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ScrollText className="h-4 w-4 text-secondary" />
                <p className="text-overline text-muted-foreground">Contratos Ativos</p>
              </div>
              <p className="text-display-sm">{executiveDashboard.activeContractsCount}</p>
              <p className="text-caption text-muted-foreground mt-1">{formatCurrency(executiveDashboard.activeContractsValue)} total</p>
            </div>
          </div>

          {/* Second row: additional indicators */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-overline text-muted-foreground mb-1">Faturas em Aberto</p>
              <p className="text-display-sm">{executiveDashboard.pendingCount}</p>
              <p className="text-caption text-muted-foreground mt-1">pendentes + vencidas</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-overline text-muted-foreground mb-1">Prazo Médio Recebimento</p>
              <p className="text-display-sm">
                {executiveDashboard.avgDaysToReceive !== null
                  ? `${executiveDashboard.avgDaysToReceive > 0 ? "+" : ""}${executiveDashboard.avgDaysToReceive.toFixed(0)} dias`
                  : "—"}
              </p>
              <p className="text-caption text-muted-foreground mt-1">após vencimento</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-overline text-muted-foreground mb-1">Próximos Vencimentos</p>
              <p className="text-display-sm">{dueSoonInvoices.length}</p>
              <p className="text-caption text-muted-foreground mt-1">nos próximos 7 dias</p>
            </div>
          </div>
        </LexCard>
      </motion.div>

      {/* Search + Create + Export */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {canManageFinancial && (
          <>
            <Button onClick={() => setCreateDialogOpen(true)}><Plus className="h-4 w-4" /> Nova Fatura</Button>
            <Button variant="secondary" onClick={() => setContractDialogOpen(true)}><Plus className="h-4 w-4" /> Novo Contrato</Button>
          </>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <Button variant="outline" size="sm" onClick={exportInvoicesCSV} disabled={filteredInvoices.length === 0}>
            <Download className="h-3.5 w-3.5" /> Faturas CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportContractsCSV} disabled={filteredContracts.length === 0}>
            <Download className="h-3.5 w-3.5" /> Contratos CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPaymentsCSV} disabled={filteredPayments.length === 0}>
            <Download className="h-3.5 w-3.5" /> Pagamentos CSV
          </Button>
        </div>
      </div>

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Faturas ({invoices.length})</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos ({payments.length})</TabsTrigger>
          <TabsTrigger value="contracts">Contratos ({contracts.length})</TabsTrigger>
          <TabsTrigger value="reports"><BarChart3 className="h-3.5 w-3.5 mr-1" /> Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-4">
          <LexCard hover={false}>
            <LexCardHeader>
              <LexCardTitle>Faturas</LexCardTitle>
              <div className="flex items-center gap-2">
                <Select value={invoiceClientFilter} onValueChange={setInvoiceClientFilter}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    <SelectItem value="none">Sem cliente</SelectItem>
                    {orgClients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="overdue">Vencido</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </LexCardHeader>
            {filteredInvoices.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-body-sm text-muted-foreground">Nenhuma fatura encontrada.</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Descrição", "Cliente", "Valor", "Status", "Vencimento", "Criado em", ...(canManageFinancial ? [""] : [])].map((h, i) => (
                        <th key={`${h}-${i}`} className="text-left py-2.5 text-overline text-muted-foreground font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedInvoices.map((inv: any) => (
                      <tr key={inv.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 font-medium">{inv.description || "—"}</td>
                        <td className="py-3.5 text-muted-foreground">{orgClients.find(c => c.id === inv.client_id)?.full_name || "—"}</td>
                        <td className="py-3.5 font-mono text-primary">{formatCurrency(inv.amount_cents)}</td>
                        <td className="py-3.5"><LexBadge variant={statusColors[inv.status] as any || "default"}>{statusLabels[inv.status] || inv.status}</LexBadge></td>
                        <td className="py-3.5 text-muted-foreground">{inv.due_date ? format(new Date(inv.due_date), "dd/MM/yyyy") : "—"}</td>
                        <td className="py-3.5 text-muted-foreground">{format(new Date(inv.created_at), "dd/MM/yyyy", { locale: ptBR })}</td>
                        {canManageFinancial && (
                          <td className="py-3.5 flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditInvoice(inv)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ type: "invoice", id: inv.id, label: inv.description || "esta fatura" })}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {invoiceTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
                    <span className="text-caption text-muted-foreground">{filteredInvoices.length} faturas — Página {invoicePage + 1} de {invoiceTotalPages}</span>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" disabled={invoicePage === 0} onClick={() => setInvoicePage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" disabled={invoicePage >= invoiceTotalPages - 1} onClick={() => setInvoicePage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </LexCard>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <LexCard hover={false}>
            <LexCardHeader>
              <LexCardTitle>Pagamentos</LexCardTitle>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="confirmed">Confirmado</SelectItem>
                  <SelectItem value="failed">Falhou</SelectItem>
                  <SelectItem value="refunded">Reembolsado</SelectItem>
                </SelectContent>
              </Select>
            </LexCardHeader>
            {filteredPayments.length === 0 ? (
              <div className="py-12 text-center">
                <CreditCard className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-body-sm text-muted-foreground">Nenhum pagamento encontrado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Valor", "Método", "Status", "Data", "ID Externo"].map((h) => (
                        <th key={h} className="text-left py-2.5 text-overline text-muted-foreground font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPayments.map((pay: any) => (
                      <tr key={pay.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 font-mono text-primary">{formatCurrency(pay.amount_cents)}</td>
                        <td className="py-3.5">{methodLabels[pay.method] || pay.method}</td>
                        <td className="py-3.5"><LexBadge variant={statusColors[pay.status] as any || "default"}>{statusLabels[pay.status] || pay.status}</LexBadge></td>
                        <td className="py-3.5 text-muted-foreground">{format(new Date(pay.created_at), "dd/MM/yyyy", { locale: ptBR })}</td>
                        <td className="py-3.5 text-muted-foreground font-mono text-caption">{pay.external_id || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {paymentTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
                    <span className="text-caption text-muted-foreground">{filteredPayments.length} pagamentos — Página {paymentPage + 1} de {paymentTotalPages}</span>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" disabled={paymentPage === 0} onClick={() => setPaymentPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" disabled={paymentPage >= paymentTotalPages - 1} onClick={() => setPaymentPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </LexCard>
        </TabsContent>

        <TabsContent value="contracts" className="mt-4">
          <LexCard hover={false}>
            <LexCardHeader>
              <LexCardTitle>Contratos</LexCardTitle>
              <Select value={contractClientFilter} onValueChange={setContractClientFilter}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  <SelectItem value="none">Sem cliente</SelectItem>
                  {orgClients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </LexCardHeader>
            {filteredContracts.length === 0 ? (
              <div className="py-12 text-center">
                <ScrollText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-body-sm text-muted-foreground">Nenhum contrato encontrado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Título", "Cliente", "Tipo", "Valor", "Periodicidade", "Status", "Início", "Fim", ...(canManageFinancial ? [""] : [])].map((h, i) => (
                        <th key={`${h}-${i}`} className="text-left py-2.5 text-overline text-muted-foreground font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedContracts.map((c: any) => (
                      <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 font-medium">{c.title}</td>
                        <td className="py-3.5 text-muted-foreground">{orgClients.find(cl => cl.id === c.client_id)?.full_name || "—"}</td>
                        <td className="py-3.5"><LexBadge variant="outline">{contractTypeLabels[c.contract_type] || c.contract_type}</LexBadge></td>
                        <td className="py-3.5 font-mono text-primary">{formatCurrency(c.amount_cents)}</td>
                        <td className="py-3.5 text-muted-foreground">{periodicityLabels[c.periodicity] || c.periodicity}</td>
                        <td className="py-3.5"><LexBadge variant={statusColors[c.status] as any || "default"}>{statusLabels[c.status] || c.status}</LexBadge></td>
                        <td className="py-3.5 text-muted-foreground">{c.start_date ? format(new Date(c.start_date), "dd/MM/yyyy") : "—"}</td>
                        <td className="py-3.5 text-muted-foreground">{c.end_date ? format(new Date(c.end_date), "dd/MM/yyyy") : "—"}</td>
                        {canManageFinancial && (
                          <td className="py-3.5 flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditContract(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ type: "contract", id: c.id, label: c.title })}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {contractTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
                    <span className="text-caption text-muted-foreground">{filteredContracts.length} contratos — Página {contractPage + 1} de {contractTotalPages}</span>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" disabled={contractPage === 0} onClick={() => setContractPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" disabled={contractPage >= contractTotalPages - 1} onClick={() => setContractPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </LexCard>
        </TabsContent>
        {/* Reports Tab */}
        <TabsContent value="reports" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by Month */}
            <LexCard hover={false}>
              <LexCardHeader>
                <LexCardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Receita por Período</LexCardTitle>
              </LexCardHeader>
              {revenueByMonth.some(m => m.receita > 0) ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(228, 12%, 18%)" />
                      <XAxis dataKey="name" tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 11 }} tickFormatter={(v) => `R$${v.toLocaleString("pt-BR")}`} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "hsl(228, 16%, 12%)", border: "1px solid hsl(228, 12%, 18%)", borderRadius: 8, color: "hsl(210, 20%, 95%)" }}
                        formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Receita"]}
                      />
                      <Bar dataKey="receita" fill="hsl(192, 95%, 55%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <p className="text-body-sm text-muted-foreground">Nenhuma receita registrada.</p>
                </div>
              )}
            </LexCard>

            {/* Revenue by Client */}
            <LexCard hover={false}>
              <LexCardHeader>
                <LexCardTitle className="flex items-center gap-2"><Users className="h-4 w-4 text-secondary" /> Receita por Cliente</LexCardTitle>
              </LexCardHeader>
              {revenueByClient.length > 0 && revenueByClient.some(c => c.value > 0) ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueByClient}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name.slice(0, 12)}${name.length > 12 ? "…" : ""} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {revenueByClient.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "hsl(228, 16%, 12%)", border: "1px solid hsl(228, 12%, 18%)", borderRadius: 8, color: "hsl(210, 20%, 95%)" }}
                        formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Receita"]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: "hsl(220, 10%, 55%)" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <p className="text-body-sm text-muted-foreground">Nenhuma receita por cliente.</p>
                </div>
              )}
            </LexCard>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Invoice Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => { setCreateDialogOpen(open); if (!open) { setEditingInvoiceId(null); setNewInvoice({ description: "", amount: "", due_date: "", status: "draft", client_id: "none" }); } }}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">{editingInvoiceId ? "Editar Fatura" : "Nova Fatura"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Descrição</label>
              <Textarea className="bg-muted border-border rounded-xl" value={newInvoice.description} onChange={(e) => setNewInvoice({ ...newInvoice, description: e.target.value })} placeholder="Honorários advocatícios..." rows={2} />
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Valor (R$)</label>
              <Input className="bg-muted border-border rounded-xl" value={newInvoice.amount} onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })} placeholder="1500,00" />
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Vencimento</label>
              <Input className="bg-muted border-border rounded-xl" type="date" value={newInvoice.due_date} onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })} />
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Cliente</label>
              <Select value={newInvoice.client_id} onValueChange={(v) => setNewInvoice({ ...newInvoice, client_id: v })}>
                <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {orgClients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Status</label>
              <Select value={newInvoice.status} onValueChange={(v) => setNewInvoice({ ...newInvoice, status: v })}>
                <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  {editingInvoiceId && <SelectItem value="paid">Pago</SelectItem>}
                  {editingInvoiceId && <SelectItem value="overdue">Vencido</SelectItem>}
                  {editingInvoiceId && <SelectItem value="cancelled">Cancelado</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
              {editingInvoiceId ? (
                <Button onClick={() => updateInvoiceMutation.mutate()} disabled={!newInvoice.amount || updateInvoiceMutation.isPending}>
                  {updateInvoiceMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              ) : (
                <Button onClick={() => createInvoiceMutation.mutate()} disabled={!newInvoice.amount || createInvoiceMutation.isPending}>
                  {createInvoiceMutation.isPending ? "Criando..." : "Criar Fatura"}
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Contract Dialog */}
      <Dialog open={contractDialogOpen} onOpenChange={(open) => { setContractDialogOpen(open); if (!open) { setEditingContractId(null); setNewContract({ title: "", description: "", contract_type: "service", amount: "", periodicity: "monthly", start_date: "", end_date: "", status: "active", terms: "", client_id: "none" }); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">{editingContractId ? "Editar Contrato" : "Novo Contrato"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Título <span className="text-destructive">*</span></label>
              <Input className="bg-muted border-border rounded-xl" value={newContract.title} onChange={(e) => setNewContract({ ...newContract, title: e.target.value })} placeholder="Contrato de honorários..." />
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Descrição</label>
              <Textarea className="bg-muted border-border rounded-xl" value={newContract.description} onChange={(e) => setNewContract({ ...newContract, description: e.target.value })} rows={2} />
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Cliente</label>
              <Select value={newContract.client_id} onValueChange={(v) => setNewContract({ ...newContract, client_id: v })}>
                <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {orgClients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Tipo</label>
                <Select value={newContract.contract_type} onValueChange={(v) => setNewContract({ ...newContract, contract_type: v })}>
                  <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(contractTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Valor (R$)</label>
                <Input className="bg-muted border-border rounded-xl" value={newContract.amount} onChange={(e) => setNewContract({ ...newContract, amount: e.target.value })} placeholder="5000,00" />
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Periodicidade</label>
                <Select value={newContract.periodicity} onValueChange={(v) => setNewContract({ ...newContract, periodicity: v })}>
                  <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(periodicityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Início</label>
                <Input className="bg-muted border-border rounded-xl" type="date" value={newContract.start_date} onChange={(e) => setNewContract({ ...newContract, start_date: e.target.value })} />
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Fim</label>
                <Input className="bg-muted border-border rounded-xl" type="date" value={newContract.end_date} onChange={(e) => setNewContract({ ...newContract, end_date: e.target.value })} />
              </div>
              <div>
                <label className="text-overline text-muted-foreground block mb-1.5">Status</label>
                <Select value={newContract.status} onValueChange={(v) => setNewContract({ ...newContract, status: v })}>
                  <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    {editingContractId && <SelectItem value="suspended">Suspenso</SelectItem>}
                    {editingContractId && <SelectItem value="completed">Concluído</SelectItem>}
                    {editingContractId && <SelectItem value="cancelled">Cancelado</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Termos e condições</label>
              <Textarea className="bg-muted border-border rounded-xl" value={newContract.terms} onChange={(e) => setNewContract({ ...newContract, terms: e.target.value })} rows={3} placeholder="Cláusulas, condições..." />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setContractDialogOpen(false)}>Cancelar</Button>
              {editingContractId ? (
                <Button onClick={() => updateContractMutation.mutate()} disabled={!newContract.title || !newContract.amount || updateContractMutation.isPending}>
                  {updateContractMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              ) : (
                <Button onClick={() => createContractMutation.mutate()} disabled={!newContract.title || !newContract.amount || createContractMutation.isPending}>
                  {createContractMutation.isPending ? "Criando..." : "Criar Contrato"}
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>"{deleteTarget?.label}"</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Financial;
