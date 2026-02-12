import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, Camera, Save, Shield, Bell, Palette, FileText, CalendarDays, MonitorSmartphone, Globe, Clock } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const SUPPORTED_LANGUAGES = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English (US)" },
  { value: "es-ES", label: "Español (España)" },
];

const SUPPORTED_TIMEZONES = [
  { value: "America/Sao_Paulo", label: "São Paulo (GMT-3)" },
  { value: "America/Manaus", label: "Manaus (GMT-4)" },
  { value: "America/Belem", label: "Belém (GMT-3)" },
  { value: "America/Fortaleza", label: "Fortaleza (GMT-3)" },
  { value: "America/Recife", label: "Recife (GMT-3)" },
  { value: "America/Bahia", label: "Bahia (GMT-3)" },
  { value: "America/Cuiaba", label: "Cuiabá (GMT-4)" },
  { value: "America/Porto_Velho", label: "Porto Velho (GMT-4)" },
  { value: "America/Rio_Branco", label: "Rio Branco (GMT-5)" },
  { value: "America/Noronha", label: "Noronha (GMT-2)" },
  { value: "America/New_York", label: "New York (GMT-5)" },
  { value: "America/Chicago", label: "Chicago (GMT-6)" },
  { value: "America/Los_Angeles", label: "Los Angeles (GMT-8)" },
  { value: "Europe/London", label: "London (GMT+0)" },
  { value: "Europe/Lisbon", label: "Lisboa (GMT+0)" },
  { value: "Europe/Madrid", label: "Madrid (GMT+1)" },
  { value: "UTC", label: "UTC" },
];

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

const Profile = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [language, setLanguage] = useState("pt-BR");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [uploading, setUploading] = useState(false);

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [notifyDeadlines, setNotifyDeadlines] = useState(true);
  const [notifyDocuments, setNotifyDocuments] = useState(true);
  const [notifyInApp, setNotifyInApp] = useState(true);

  // UI preferences
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem("lex-compact") === "true");
  const [defaultView, setDefaultView] = useState(() => localStorage.getItem("lex-view") || "dashboard");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setAvatarUrl(profile.avatar_url || "");
      setLanguage((profile as any).language || "pt-BR");
      setTimezone((profile as any).timezone || "America/Sao_Paulo");
      setEmailNotifications((profile as any).email_notifications ?? true);
      setNotifyDeadlines((profile as any).notify_deadlines ?? true);
      setNotifyDocuments((profile as any).notify_documents ?? true);
      setNotifyInApp((profile as any).notify_in_app ?? true);
    }
  }, [profile]);

  const nameValid = useMemo(() => fullName.trim().length >= 2 && fullName.trim().length <= 120, [fullName]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!nameValid) throw new Error("Nome deve ter entre 2 e 120 caracteres.");

      const updateData = {
        full_name: fullName.trim(),
        phone,
        avatar_url: avatarUrl,
        language,
        timezone,
      } as any;

      if (profile) {
        const { error } = await supabase.from("profiles").update(updateData).eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("profiles").insert({ ...updateData, user_id: user!.id });
        if (error) throw error;
      }

      // Detect changed fields for audit
      const changedFields: string[] = [];
      if (profile?.full_name !== fullName.trim()) changedFields.push("full_name");
      if (profile?.phone !== phone) changedFields.push("phone");
      if (profile?.avatar_url !== avatarUrl) changedFields.push("avatar_url");
      if ((profile as any)?.language !== language) changedFields.push("language");
      if ((profile as any)?.timezone !== timezone) changedFields.push("timezone");

      if (changedFields.length > 0) {
        await supabase.from("audit_logs").insert({
          action: "profile_updated",
          user_id: user!.id,
          resource_type: "profile",
          metadata: {
            fields_changed: changedFields,
            user_agent: navigator.userAgent,
          },
        } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Perfil atualizado com sucesso!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WEBP.");
      return;
    }
    // Validate size
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("Arquivo muito grande. Máximo 5MB.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user!.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(newUrl);
      toast.success("Avatar enviado!");
    } catch (err: any) {
      toast.error("Erro ao enviar avatar: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const savePreferencesMutation = useMutation({
    mutationFn: async () => {
      localStorage.setItem("lex-compact", String(compactMode));
      localStorage.setItem("lex-view", defaultView);
      if (user) {
        const { error } = await supabase.from("profiles").update({
          email_notifications: emailNotifications,
          notify_deadlines: notifyDeadlines,
          notify_documents: notifyDocuments,
          notify_in_app: notifyInApp,
        } as any).eq("user_id", user.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Preferências salvas!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const initials = fullName
    ? fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "U";

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse-glow" />
          <span className="h-2.5 w-2.5 rounded-full bg-secondary animate-pulse-glow" style={{ animationDelay: "200ms" }} />
          <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse-glow" style={{ animationDelay: "400ms" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-overline text-primary mb-1">Conta</p>
        <h1 className="text-display-lg">Meu Perfil</h1>
        <p className="text-body-sm text-muted-foreground mt-1">Gerencie suas informações pessoais e preferências</p>
      </motion.div>

      {/* Avatar & Info */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <LexCard hover={false}>
          <LexCardHeader>
            <LexCardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Informações Pessoais</LexCardTitle>
          </LexCardHeader>

          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex flex-col items-center gap-3">
              <div className="relative group">
                <Avatar className="h-24 w-24 border-2 border-primary/30">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt="Avatar" /> : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-display-sm">{initials}</AvatarFallback>
                </Avatar>
                <label className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="h-6 w-6 text-foreground" />
                  <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
                </label>
              </div>
              <p className="text-caption text-muted-foreground">{uploading ? "Enviando..." : "JPG, PNG ou WEBP (max 5MB)"}</p>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <Label className="text-overline text-muted-foreground mb-1.5 flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Nome Completo</Label>
                <Input
                  className="bg-muted border-border rounded-xl"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                  minLength={2}
                  maxLength={120}
                />
                {fullName && !nameValid && (
                  <p className="text-caption text-destructive mt-1">Nome deve ter entre 2 e 120 caracteres.</p>
                )}
              </div>
              <div>
                <Label className="text-overline text-muted-foreground mb-1.5 flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
                <Input className="bg-muted border-border rounded-xl opacity-60" value={user?.email || ""} disabled />
                <p className="text-caption text-muted-foreground mt-1">Gerenciado pelo sistema de autenticação.</p>
              </div>
              <div>
                <Label className="text-overline text-muted-foreground mb-1.5 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Telefone</Label>
                <Input className="bg-muted border-border rounded-xl" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-overline text-muted-foreground mb-1.5 flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Idioma</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-overline text-muted-foreground mb-1.5 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || !nameValid} className="mt-2">
                <Save className="h-4 w-4" /> {updateMutation.isPending ? "Salvando..." : "Salvar Informações"}
              </Button>
            </div>
          </div>
        </LexCard>
      </motion.div>

      {/* Notification Preferences */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <LexCard hover={false}>
          <LexCardHeader>
            <LexCardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-warning" /> Notificações</LexCardTitle>
          </LexCardHeader>

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MonitorSmartphone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-body-sm font-medium">Notificações no App</p>
                  <p className="text-caption text-muted-foreground">Sino de notificações em tempo real</p>
                </div>
              </div>
              <Switch checked={notifyInApp} onCheckedChange={setNotifyInApp} />
            </div>

            <Separator className="bg-border" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-body-sm font-medium">Notificações por Email</p>
                  <p className="text-caption text-muted-foreground">Receber alertas por email</p>
                </div>
              </div>
              <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
            </div>

            <Separator className="bg-border" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-body-sm font-medium">Alertas de Prazos</p>
                  <p className="text-caption text-muted-foreground">Notificar quando prazos estão próximos (24h/48h)</p>
                </div>
              </div>
              <Switch checked={notifyDeadlines} onCheckedChange={setNotifyDeadlines} />
            </div>

            <Separator className="bg-border" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-body-sm font-medium">Novos Documentos</p>
                  <p className="text-caption text-muted-foreground">Notificar quando documentos são adicionados</p>
                </div>
              </div>
              <Switch checked={notifyDocuments} onCheckedChange={setNotifyDocuments} />
            </div>

            <Button variant="outline" onClick={() => savePreferencesMutation.mutate()} disabled={savePreferencesMutation.isPending} className="mt-2">
              <Save className="h-4 w-4" /> {savePreferencesMutation.isPending ? "Salvando..." : "Salvar Notificações"}
            </Button>
          </div>
        </LexCard>
      </motion.div>

      {/* UI Preferences */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <LexCard hover={false}>
          <LexCardHeader>
            <LexCardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-secondary" /> Interface</LexCardTitle>
          </LexCardHeader>

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-body-sm font-medium">Modo Compacto</p>
                  <p className="text-caption text-muted-foreground">Reduzir espaçamentos e tamanho de cards</p>
                </div>
              </div>
              <Switch checked={compactMode} onCheckedChange={setCompactMode} />
            </div>

            <Separator className="bg-border" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-body-sm font-medium">Página Inicial</p>
                  <p className="text-caption text-muted-foreground">Tela exibida após o login</p>
                </div>
              </div>
              <Select value={defaultView} onValueChange={setDefaultView}>
                <SelectTrigger className="w-40 bg-muted border-border rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dashboard">Dashboard</SelectItem>
                  <SelectItem value="processes">Processos</SelectItem>
                  <SelectItem value="chat">Chat IA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" onClick={() => savePreferencesMutation.mutate()} disabled={savePreferencesMutation.isPending} className="mt-2">
              <Save className="h-4 w-4" /> {savePreferencesMutation.isPending ? "Salvando..." : "Salvar Interface"}
            </Button>
          </div>
        </LexCard>
      </motion.div>
    </div>
  );
};

export default Profile;
