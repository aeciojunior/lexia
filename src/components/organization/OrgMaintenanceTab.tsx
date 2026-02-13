import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Wrench, AlertTriangle, Power } from "lucide-react";
import { toast } from "sonner";

interface Props {
  activeOrgId: string;
  isOwner: boolean;
}

export const OrgMaintenanceTab = ({ activeOrgId, isOwner }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
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

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("Sistema em manutenção. Voltaremos em breve.");
  const [adminAccess, setAdminAccess] = useState(false);

  useEffect(() => {
    if (settings) {
      setMaintenanceMode(settings.maintenance_mode ?? false);
      setMaintenanceMessage(settings.maintenance_message || "Sistema em manutenção. Voltaremos em breve.");
      setAdminAccess(settings.maintenance_admin_access ?? false);
    }
  }, [settings]);

  const toggleMutation = useMutation({
    mutationFn: async (enable: boolean) => {
      const updateData: any = {
        maintenance_mode: enable,
        maintenance_message: maintenanceMessage,
        maintenance_admin_access: adminAccess,
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
        action: enable ? "maintenance_mode_enabled" : "maintenance_mode_disabled",
        user_id: user!.id,
        organization_id: activeOrgId,
        resource_type: "organization",
        resource_id: activeOrgId,
        metadata: {
          maintenance_mode: enable,
          admin_access: adminAccess,
          user_agent: navigator.userAgent,
        },
      } as any);

      setMaintenanceMode(enable);
    },
    onSuccess: (_, enable) => {
      queryClient.invalidateQueries({ queryKey: ["org-settings-detail"] });
      toast.success(enable ? "Modo de manutenção ativado" : "Modo de manutenção desativado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isOwner) {
    return (
      <LexCard hover={false}>
        <LexCardHeader>
          <LexCardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" /> Modo de Manutenção
          </LexCardTitle>
        </LexCardHeader>
        <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
          <p className="text-body-sm text-warning font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Somente o proprietário pode gerenciar o modo de manutenção.
          </p>
        </div>
        {maintenanceMode && (
          <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-body-sm text-destructive font-medium">⚠️ O sistema está em modo de manutenção.</p>
          </div>
        )}
      </LexCard>
    );
  }

  return (
    <LexCard hover={false}>
      <LexCardHeader>
        <LexCardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" /> Modo de Manutenção
        </LexCardTitle>
        {maintenanceMode && <LexBadge variant="destructive">Ativo</LexBadge>}
      </LexCardHeader>

      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <p className="text-body-sm text-muted-foreground">
            Quando ativado, todos os usuários (exceto o Owner{adminAccess ? " e Admins" : ""}) serão bloqueados temporariamente. Use para migrações, ajustes de segurança ou reestruturações.
          </p>
        </div>

        <div>
          <label className="text-overline text-muted-foreground block mb-1.5">Mensagem de manutenção</label>
          <Input
            className="bg-muted border-border rounded-xl max-w-md"
            value={maintenanceMessage}
            onChange={(e) => setMaintenanceMessage(e.target.value)}
            placeholder="Mensagem exibida aos usuários"
          />
        </div>

        <div className="flex items-center justify-between max-w-md">
          <div>
            <p className="text-body-sm font-medium">Permitir acesso de Admins</p>
            <p className="text-caption text-muted-foreground">Admins poderão acessar durante a manutenção</p>
          </div>
          <Switch checked={adminAccess} onCheckedChange={setAdminAccess} />
        </div>

        <div className="pt-2">
          {maintenanceMode ? (
            <Button variant="outline" onClick={() => toggleMutation.mutate(false)} disabled={toggleMutation.isPending}>
              <Power className="h-4 w-4" /> Desativar Manutenção
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => toggleMutation.mutate(true)} disabled={toggleMutation.isPending}>
              <Power className="h-4 w-4" /> Ativar Modo de Manutenção
            </Button>
          )}
        </div>
      </div>
    </LexCard>
  );
};
