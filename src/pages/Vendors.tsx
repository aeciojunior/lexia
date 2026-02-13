import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Building, Plus, FileText, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Vendors = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", cnpj: "", email: "", phone: "", business_area: "", notes: "" });
  const canManage = hasPermission("MANAGE_VENDORS");

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["vendors", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("*").eq("organization_id", activeOrgId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["vendor-contracts", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendor_contracts").select("*").eq("organization_id", activeOrgId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeOrgId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vendors").insert({
        organization_id: activeOrgId!,
        name: form.name,
        cnpj: form.cnpj || null,
        email: form.email || null,
        phone: form.phone || null,
        business_area: form.business_area || null,
        notes: form.notes || null,
        created_by: user!.id,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({ action: "vendor_created", user_id: user!.id, organization_id: activeOrgId!, resource_type: "vendor", metadata: { name: form.name } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setOpen(false);
      setForm({ name: "", cnpj: "", email: "", phone: "", business_area: "", notes: "" });
      toast({ title: "Fornecedor cadastrado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const vendorContracts = contracts.filter(c => c.vendor_id === selectedVendor);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Fornecedores</h1>
          <p className="text-muted-foreground">Gestão de fornecedores e contratos</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo Fornecedor</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Cadastrar Fornecedor</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} /></div>
                  <div><Label>Área</Label><Input value={form.business_area} onChange={e => setForm(f => ({ ...f, business_area: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>E-mail</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                  <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                </div>
                <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
                <Button onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending} className="w-full">Cadastrar</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="vendors">
        <TabsList>
          <TabsTrigger value="vendors">Fornecedores ({vendors.length})</TabsTrigger>
          <TabsTrigger value="contracts">Contratos ({contracts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="vendors" className="space-y-4">
          {isLoading ? <p className="text-muted-foreground">Carregando...</p> :
            vendors.length === 0 ? (
              <Card><CardContent className="py-12 text-center"><Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhum fornecedor</p></CardContent></Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {vendors.map(v => (
                  <Card key={v.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setSelectedVendor(v.id)}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <Building className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">{v.name}</CardTitle>
                        <Badge variant={v.status === "active" ? "default" : v.status === "suspended" ? "destructive" : "outline"}>{v.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {v.cnpj && <p>CNPJ: {v.cnpj}</p>}
                        {v.email && <p>{v.email}</p>}
                        {v.business_area && <Badge variant="outline" className="mt-1">{v.business_area}</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          }
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4">
          {contracts.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhum contrato</p></CardContent></Card>
          ) : (
            contracts.map(c => {
              const vendor = vendors.find(v => v.id === c.vendor_id);
              return (
                <Card key={c.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">{c.title}</CardTitle>
                        <Badge variant={c.status === "active" ? "default" : "outline"}>{c.status}</Badge>
                        {vendor && <Badge variant="secondary">{vendor.name}</Badge>}
                      </div>
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <DollarSign className="h-4 w-4" />
                        {(c.amount_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: c.currency })}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-muted-foreground flex gap-4">
                      {c.start_date && <span>Início: {format(new Date(c.start_date), "dd/MM/yyyy", { locale: ptBR })}</span>}
                      {c.end_date && <span>Fim: {format(new Date(c.end_date), "dd/MM/yyyy", { locale: ptBR })}</span>}
                      {c.renewal_date && <span>Renovação: {format(new Date(c.renewal_date), "dd/MM/yyyy", { locale: ptBR })}</span>}
                      {c.auto_renew && <Badge variant="outline" className="text-xs">Auto-renovar</Badge>}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Vendors;
