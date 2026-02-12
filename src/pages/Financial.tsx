import { useState } from "react";
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
import { DollarSign, FileText, CreditCard, TrendingUp, Search, Lock, Plus, ScrollText } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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

const Financial = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const { isFree } = usePlanLimits();
  const queryClient = useQueryClient();
  const [invoiceStatus, setInvoiceStatus] = useState<string>("all");
  const [paymentStatus, setPaymentStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [newInvoice, setNewInvoice] = useState({ description: "", amount: "", due_date: "", status: "draft" });
  const [newContract, setNewContract] = useState({ title: "", description: "", contract_type: "service", amount: "", periodicity: "monthly", start_date: "", end_date: "", status: "active", terms: "" });

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

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  const totalPending = invoices.filter((i: any) => i.status === "pending").reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
  const totalPaid = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
  const totalOverdue = invoices.filter((i: any) => i.status === "overdue").reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
  const totalContracts = contracts.reduce((s: number, c: any) => s + (c.amount_cents || 0), 0);

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

  const kpis = [
    { label: "Pendente", value: formatCurrency(totalPending), icon: FileText, variant: "warning" },
    { label: "Recebido", value: formatCurrency(totalPaid), icon: TrendingUp, variant: "success" },
    { label: "Vencido", value: formatCurrency(totalOverdue), icon: DollarSign, variant: "destructive" },
    { label: "Contratos", value: `${contracts.length} (${formatCurrency(totalContracts)})`, icon: ScrollText, variant: "primary" },
  ];

  const filteredInvoices = invoices.filter((i: any) => !search || i.description?.toLowerCase().includes(search.toLowerCase()));
  const filteredPayments = payments.filter((p: any) => !search || p.external_id?.toLowerCase().includes(search.toLowerCase()));

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      const amountCents = Math.round(parseFloat(newInvoice.amount.replace(",", ".")) * 100);
      if (isNaN(amountCents) || amountCents <= 0) throw new Error("Valor inválido");
      const { error } = await supabase.from("invoices" as any).insert({
        organization_id: activeOrgId, user_id: user!.id,
        description: newInvoice.description, amount_cents: amountCents,
        due_date: newInvoice.due_date || null, status: newInvoice.status,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "billing_generated", user_id: user!.id, organization_id: activeOrgId, resource_type: "invoice", metadata: { amount_cents: amountCents } } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setCreateDialogOpen(false);
      setNewInvoice({ description: "", amount: "", due_date: "", status: "draft" });
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
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "contract_created", user_id: user!.id, organization_id: activeOrgId, resource_type: "contract", metadata: { title: newContract.title, amount_cents: amountCents } } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setContractDialogOpen(false);
      setNewContract({ title: "", description: "", contract_type: "service", amount: "", periodicity: "monthly", start_date: "", end_date: "", status: "active", terms: "" });
      toast.success("Contrato criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

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

      {/* Search + Create */}
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
      </div>

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Faturas ({invoices.length})</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos ({payments.length})</TabsTrigger>
          <TabsTrigger value="contracts">Contratos ({contracts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-4">
          <LexCard hover={false}>
            <LexCardHeader>
              <LexCardTitle>Faturas</LexCardTitle>
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
                      {["Descrição", "Valor", "Status", "Vencimento", "Criado em"].map((h) => (
                        <th key={h} className="text-left py-2.5 text-overline text-muted-foreground font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((inv: any) => (
                      <tr key={inv.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 font-medium">{inv.description || "—"}</td>
                        <td className="py-3.5 font-mono text-primary">{formatCurrency(inv.amount_cents)}</td>
                        <td className="py-3.5"><LexBadge variant={statusColors[inv.status] as any || "default"}>{statusLabels[inv.status] || inv.status}</LexBadge></td>
                        <td className="py-3.5 text-muted-foreground">{inv.due_date ? format(new Date(inv.due_date), "dd/MM/yyyy") : "—"}</td>
                        <td className="py-3.5 text-muted-foreground">{format(new Date(inv.created_at), "dd/MM/yyyy", { locale: ptBR })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                    {filteredPayments.map((pay: any) => (
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
              </div>
            )}
          </LexCard>
        </TabsContent>

        <TabsContent value="contracts" className="mt-4">
          <LexCard hover={false}>
            <LexCardHeader>
              <LexCardTitle>Contratos</LexCardTitle>
            </LexCardHeader>
            {contracts.length === 0 ? (
              <div className="py-12 text-center">
                <ScrollText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-body-sm text-muted-foreground">Nenhum contrato encontrado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Título", "Tipo", "Valor", "Periodicidade", "Status", "Início", "Fim"].map((h) => (
                        <th key={h} className="text-left py-2.5 text-overline text-muted-foreground font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map((c: any) => (
                      <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 font-medium">{c.title}</td>
                        <td className="py-3.5"><LexBadge variant="outline">{contractTypeLabels[c.contract_type] || c.contract_type}</LexBadge></td>
                        <td className="py-3.5 font-mono text-primary">{formatCurrency(c.amount_cents)}</td>
                        <td className="py-3.5 text-muted-foreground">{periodicityLabels[c.periodicity] || c.periodicity}</td>
                        <td className="py-3.5"><LexBadge variant={statusColors[c.status] as any || "default"}>{statusLabels[c.status] || c.status}</LexBadge></td>
                        <td className="py-3.5 text-muted-foreground">{c.start_date ? format(new Date(c.start_date), "dd/MM/yyyy") : "—"}</td>
                        <td className="py-3.5 text-muted-foreground">{c.end_date ? format(new Date(c.end_date), "dd/MM/yyyy") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </LexCard>
        </TabsContent>
      </Tabs>

      {/* Create Invoice Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Nova Fatura</DialogTitle></DialogHeader>
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
              <label className="text-overline text-muted-foreground block mb-1.5">Status</label>
              <Select value={newInvoice.status} onValueChange={(v) => setNewInvoice({ ...newInvoice, status: v })}>
                <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => createInvoiceMutation.mutate()} disabled={!newInvoice.amount || createInvoiceMutation.isPending}>
                {createInvoiceMutation.isPending ? "Criando..." : "Criar Fatura"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Contract Dialog */}
      <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader><DialogTitle className="text-display-sm">Novo Contrato</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Título <span className="text-destructive">*</span></label>
              <Input className="bg-muted border-border rounded-xl" value={newContract.title} onChange={(e) => setNewContract({ ...newContract, title: e.target.value })} placeholder="Contrato de honorários..." />
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Descrição</label>
              <Textarea className="bg-muted border-border rounded-xl" value={newContract.description} onChange={(e) => setNewContract({ ...newContract, description: e.target.value })} rows={2} />
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
              <Button onClick={() => createContractMutation.mutate()} disabled={!newContract.title || !newContract.amount || createContractMutation.isPending}>
                {createContractMutation.isPending ? "Criando..." : "Criar Contrato"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Financial;
