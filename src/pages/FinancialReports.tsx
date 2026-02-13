import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, DollarSign, AlertTriangle, TrendingUp, FileDown } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

export default function FinancialReports() {
  const { activeOrgId } = useOrganization();
  const [reportType, setReportType] = useState("billing");
  const [period, setPeriod] = useState("current");

  const now = new Date();
  const getRange = () => {
    if (period === "current") return { from: startOfMonth(now).toISOString(), to: endOfMonth(now).toISOString() };
    if (period === "last") return { from: startOfMonth(subMonths(now, 1)).toISOString(), to: endOfMonth(subMonths(now, 1)).toISOString() };
    return { from: startOfMonth(subMonths(now, 2)).toISOString(), to: now.toISOString() };
  };

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["fin-report-invoices", activeOrgId, period],
    queryFn: async () => {
      const range = getRange();
      const { data, error } = await supabase
        .from("invoices")
        .select("*, clients(full_name)")
        .eq("organization_id", activeOrgId!)
        .gte("created_at", range.from)
        .lte("created_at", range.to)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ["fin-report-contracts", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*, clients(full_name)")
        .eq("organization_id", activeOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrgId && reportType === "contracts",
  });

  const totalBilled = invoices.reduce((sum: number, i: any) => sum + (i.amount_cents || 0), 0);
  const totalPaid = invoices.filter((i: any) => i.status === "paid").reduce((sum: number, i: any) => sum + (i.amount_cents || 0), 0);
  const totalOverdue = invoices.filter((i: any) => i.status === "overdue" || (i.status === "sent" && i.due_date && new Date(i.due_date) < now)).reduce((sum: number, i: any) => sum + (i.amount_cents || 0), 0);
  const fmt = (v: number) => `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const exportCSV = () => {
    const rows = invoices.map((i: any) => [i.description || "", fmt(i.amount_cents), i.status, i.due_date || ""].join(","));
    const csv = ["Descrição,Valor,Status,Vencimento", ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "relatorio-financeiro.csv"; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Relatórios Financeiros
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Análises financeiras avançadas</p>
        </div>
        <Button variant="outline" onClick={exportCSV}><FileDown className="h-4 w-4 mr-2" /> Exportar CSV</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div>
          <Label className="text-xs">Tipo</Label>
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="billing">Faturamento</SelectItem>
              <SelectItem value="overdue">Inadimplência</SelectItem>
              <SelectItem value="contracts">Contratos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Período</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Mês atual</SelectItem>
              <SelectItem value="last">Mês anterior</SelectItem>
              <SelectItem value="quarter">Último trimestre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 flex items-center gap-4"><DollarSign className="h-8 w-8 text-primary" /><div><p className="text-sm text-muted-foreground">Total Faturado</p><p className="text-xl font-bold">{fmt(totalBilled)}</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-4"><TrendingUp className="h-8 w-8 text-primary" /><div><p className="text-sm text-muted-foreground">Total Recebido</p><p className="text-xl font-bold">{fmt(totalPaid)}</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-4"><AlertTriangle className="h-8 w-8 text-destructive" /><div><p className="text-sm text-muted-foreground">Inadimplente</p><p className="text-xl font-bold">{fmt(totalOverdue)}</p></div></CardContent></Card>
      </div>

      {/* Data table */}
      <Card>
        <CardHeader><CardTitle>{reportType === "contracts" ? "Contratos" : "Faturas"}</CardTitle></CardHeader>
        <CardContent>
          {reportType !== "contracts" ? (
            loadingInvoices ? <p className="text-muted-foreground text-center py-8">Carregando...</p> : invoices.length === 0 ? <p className="text-muted-foreground text-center py-8">Sem dados</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Cliente</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Vencimento</TableHead></TableRow></TableHeader>
                <TableBody>
                  {invoices.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.description || "—"}</TableCell>
                      <TableCell>{(inv as any).clients?.full_name || "—"}</TableCell>
                      <TableCell className="font-medium">{fmt(inv.amount_cents)}</TableCell>
                      <TableCell><Badge variant={inv.status === "paid" ? "default" : inv.status === "overdue" ? "destructive" : "secondary"}>{inv.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-sm">{inv.due_date ? format(new Date(inv.due_date), "dd/MM/yyyy") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          ) : (
            loadingContracts ? <p className="text-muted-foreground text-center py-8">Carregando...</p> : contracts.length === 0 ? <p className="text-muted-foreground text-center py-8">Sem dados</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Título</TableHead><TableHead>Cliente</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Início</TableHead><TableHead>Término</TableHead></TableRow></TableHeader>
                <TableBody>
                  {contracts.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.title}</TableCell>
                      <TableCell>{(c as any).clients?.full_name || "—"}</TableCell>
                      <TableCell>{fmt(c.amount_cents)}</TableCell>
                      <TableCell><Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.start_date || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.end_date || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
