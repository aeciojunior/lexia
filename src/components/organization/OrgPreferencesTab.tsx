import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Save, Globe, Brain, Bell, Mail } from "lucide-react";
import { toast } from "sonner";

interface Props {
  activeOrgId: string;
  isOwnerOrAdmin: boolean;
}

const NOTIFICATION_EVENT_LABELS: Record<string, string> = {
  deadlines: "Prazos",
  movements: "Movimentações",
  hearings: "Audiências",
  invoices: "Faturas",
  contracts: "Contratos",
  security: "Segurança (obrigatório)",
  invites: "Convites",
};

export const OrgPreferencesTab = ({ activeOrgId, isOwnerOrAdmin }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["org-settings-detail", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_settings")
        .select("*")
        .eq("organization_id", activeOrgId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!activeOrgId,
  });

  // Locale
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [locale, setLocale] = useState("pt-BR");
  const [currency, setCurrency] = useState("BRL");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");

  // AI
  const [aiStyle, setAiStyle] = useState("formal");
  const [aiInstructions, setAiInstructions] = useState("");

  // Notifications
  const [notifInternal, setNotifInternal] = useState(true);
  const [notifExternal, setNotifExternal] = useState(false);
  const [notifFrequency, setNotifFrequency] = useState("immediate");
  const [notifEvents, setNotifEvents] = useState<Record<string, boolean>>({
    deadlines: true, movements: true, hearings: true,
    invoices: true, contracts: true, security: true, invites: true,
  });

  // Communication
  const [senderEmail, setSenderEmail] = useState("");
  const [emailSignature, setEmailSignature] = useState("");

  useEffect(() => {
    if (settings) {
      setTimezone(settings.timezone || "America/Sao_Paulo");
      setLocale(settings.locale || "pt-BR");
      setCurrency(settings.currency || "BRL");
      setDateFormat(settings.date_format || "DD/MM/YYYY");
      setAiStyle(settings.ai_style || "formal");
      setAiInstructions(settings.ai_instructions || "");
      setNotifInternal(settings.notifications_internal ?? true);
      setNotifExternal(settings.notifications_external ?? false);
      setNotifFrequency(settings.notification_frequency || "immediate");
      setNotifEvents(settings.notification_events || {
        deadlines: true, movements: true, hearings: true,
        invoices: true, contracts: true, security: true, invites: true,
      });
      setSenderEmail(settings.sender_email || "");
      setEmailSignature(settings.email_signature || "");
    }
  }, [settings]);

  const toggleEvent = (key: string) => {
    if (key === "security") return; // security notifications are mandatory
    setNotifEvents((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updateData: any = {
        timezone, locale, currency,
        date_format: dateFormat,
        ai_style: aiStyle,
        ai_instructions: aiInstructions || null,
        notifications_internal: notifInternal,
        notifications_external: notifExternal,
        notification_frequency: notifFrequency,
        notification_events: { ...notifEvents, security: true },
        sender_email: senderEmail || null,
        email_signature: emailSignature || null,
      };

      if (settings) {
        const { error } = await supabase
          .from("organization_settings")
          .update(updateData)
          .eq("organization_id", activeOrgId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("organization_settings")
          .insert({ ...updateData, organization_id: activeOrgId });
        if (error) throw error;
      }

      await supabase.from("audit_logs").insert({
        action: "organization_preferences_updated",
        user_id: user!.id,
        organization_id: activeOrgId,
        resource_type: "organization",
        resource_id: activeOrgId,
        metadata: {
          fields_changed: Object.keys(updateData),
          user_agent: navigator.userAgent,
        },
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-settings-detail"] });
      toast.success("Configurações gerais atualizadas!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return null;

  return (
    <div className="space-y-6">
      {/* Locale */}
      <LexCard hover={false}>
        <LexCardHeader>
          <LexCardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" /> Idioma & Localização
          </LexCardTitle>
        </LexCardHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Idioma padrão</label>
              <Select value={locale} onValueChange={setLocale} disabled={!isOwnerOrAdmin}>
                <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-BR">Português (BR)</SelectItem>
                  <SelectItem value="en-US">English (US)</SelectItem>
                  <SelectItem value="es-ES">Español</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-caption text-muted-foreground mt-1">Aplicado a novos usuários automaticamente</p>
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Timezone</label>
              <Select value={timezone} onValueChange={setTimezone} disabled={!isOwnerOrAdmin}>
                <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/Sao_Paulo">São Paulo (GMT-3)</SelectItem>
                  <SelectItem value="America/Manaus">Manaus (GMT-4)</SelectItem>
                  <SelectItem value="America/Recife">Recife (GMT-3)</SelectItem>
                  <SelectItem value="America/New_York">New York (GMT-5)</SelectItem>
                  <SelectItem value="Europe/Lisbon">Lisboa (GMT+0)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Moeda</label>
              <Select value={currency} onValueChange={setCurrency} disabled={!isOwnerOrAdmin}>
                <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">Real (R$)</SelectItem>
                  <SelectItem value="USD">Dólar (US$)</SelectItem>
                  <SelectItem value="EUR">Euro (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-overline text-muted-foreground block mb-1.5">Formato de Data</label>
              <Select value={dateFormat} onValueChange={setDateFormat} disabled={!isOwnerOrAdmin}>
                <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </LexCard>

      {/* AI */}
      <LexCard hover={false}>
        <LexCardHeader>
          <LexCardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" /> Configurações de IA
          </LexCardTitle>
        </LexCardHeader>
        <div className="space-y-4">
          <div>
            <label className="text-overline text-muted-foreground block mb-1.5">Estilo de Escrita</label>
            <Select value={aiStyle} onValueChange={setAiStyle} disabled={!isOwnerOrAdmin}>
              <SelectTrigger className="bg-muted border-border rounded-xl max-w-md"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="formal">Formal</SelectItem>
                <SelectItem value="tecnico">Técnico</SelectItem>
                <SelectItem value="acessivel">Acessível</SelectItem>
                <SelectItem value="persuasivo">Persuasivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-overline text-muted-foreground block mb-1.5">Instruções adicionais para IA</label>
            <Textarea
              className="bg-muted border-border rounded-xl max-w-md"
              value={aiInstructions}
              onChange={(e) => setAiInstructions(e.target.value)}
              placeholder="Ex: Sempre citar artigos de lei quando aplicável..."
              rows={3}
              disabled={!isOwnerOrAdmin}
            />
          </div>
        </div>
      </LexCard>

      {/* Notifications */}
      <LexCard hover={false}>
        <LexCardHeader>
          <LexCardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> Notificações
          </LexCardTitle>
        </LexCardHeader>
        <div className="space-y-5">
          {/* Channels */}
          <div className="space-y-3 max-w-md">
            <p className="text-overline text-muted-foreground">Canais</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-body-sm font-medium">Notificações internas</p>
                <p className="text-caption text-muted-foreground">Alertas dentro da plataforma</p>
              </div>
              <Switch checked={notifInternal} onCheckedChange={setNotifInternal} disabled={!isOwnerOrAdmin} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-body-sm font-medium">Notificações externas</p>
                <p className="text-caption text-muted-foreground">E-mail e WhatsApp</p>
              </div>
              <Switch checked={notifExternal} onCheckedChange={setNotifExternal} disabled={!isOwnerOrAdmin} />
            </div>
          </div>

          {/* Frequency */}
          <div className="max-w-md">
            <label className="text-overline text-muted-foreground block mb-1.5">Frequência</label>
            <Select value={notifFrequency} onValueChange={setNotifFrequency} disabled={!isOwnerOrAdmin}>
              <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Imediata</SelectItem>
                <SelectItem value="daily">Resumo diário</SelectItem>
                <SelectItem value="weekly">Resumo semanal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Events */}
          <div className="max-w-md space-y-2">
            <p className="text-overline text-muted-foreground">Eventos que geram notificações</p>
            {Object.entries(NOTIFICATION_EVENT_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between py-1">
                <span className="text-body-sm">{label}</span>
                <Switch
                  checked={notifEvents[key] ?? true}
                  onCheckedChange={() => toggleEvent(key)}
                  disabled={!isOwnerOrAdmin || key === "security"}
                />
              </div>
            ))}
            <p className="text-caption text-muted-foreground">Notificações de segurança não podem ser desativadas.</p>
          </div>
        </div>
      </LexCard>

      {/* Communication / Sender */}
      <LexCard hover={false}>
        <LexCardHeader>
          <LexCardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> Comunicação
          </LexCardTitle>
        </LexCardHeader>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="text-overline text-muted-foreground block mb-1.5">E-mail remetente padrão</label>
            <Input
              className="bg-muted border-border rounded-xl"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="no-reply@seuescritorio.com.br"
              type="email"
              disabled={!isOwnerOrAdmin}
            />
          </div>
          <div>
            <label className="text-overline text-muted-foreground block mb-1.5">Assinatura de e-mail</label>
            <Textarea
              className="bg-muted border-border rounded-xl"
              value={emailSignature}
              onChange={(e) => setEmailSignature(e.target.value)}
              placeholder="Atenciosamente, Escritório XYZ..."
              rows={3}
              disabled={!isOwnerOrAdmin}
            />
          </div>
        </div>
      </LexCard>

      {isOwnerOrAdmin && (
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4" /> {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
        </Button>
      )}
    </div>
  );
};
