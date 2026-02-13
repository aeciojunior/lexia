import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LexCard, LexCardHeader, LexCardTitle } from "@/components/lexia/LexCard";
import { LexBadge } from "@/components/lexia/LexBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Building2, Save, Camera, Loader2, Crown } from "lucide-react";
import { toast } from "sonner";
import { usePlanLimits, PLAN_LABELS } from "@/hooks/usePlanLimits";

interface Props {
  org: any;
  activeOrgId: string;
  isOwnerOrAdmin: boolean;
  currentUserRole: string;
  isTrial: boolean;
  trialDaysLeft: number | null;
}

export const OrgGeneralTab = ({ org, activeOrgId, isOwnerOrAdmin, currentUserRole, isTrial, trialDaysLeft }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { plan } = usePlanLimits();
  const [orgName, setOrgName] = useState(org?.name || "");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const updateOrgMutation = useMutation({
    mutationFn: async () => {
      const changedFields: string[] = [];
      if (org?.name !== orgName) changedFields.push("name");

      const { error } = await supabase
        .from("organizations")
        .update({ name: orgName } as any)
        .eq("id", activeOrgId);
      if (error) throw error;

      if (changedFields.length > 0) {
        await supabase.from("audit_logs").insert({
          action: "organization_updated",
          user_id: user!.id,
          organization_id: activeOrgId,
          resource_type: "organization",
          resource_id: activeOrgId,
          metadata: { fields_changed: changedFields, user_agent: navigator.userAgent },
        } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-details"] });
      queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
      toast.success("Organização atualizada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Máximo 2MB"); return; }

    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${activeOrgId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage.from("org-logos").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("org-logos").getPublicUrl(path);
      const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.from("organizations").update({ logo_url: logoUrl } as any).eq("id", activeOrgId);
      if (updateError) throw updateError;

      await supabase.from("audit_logs").insert({
        action: "organization_logo_updated",
        user_id: user!.id,
        organization_id: activeOrgId,
        resource_type: "organization",
        resource_id: activeOrgId,
        metadata: { user_agent: navigator.userAgent },
      } as any);

      queryClient.invalidateQueries({ queryKey: ["org-details"] });
      queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
      toast.success("Logo atualizado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar logo");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleLogoRemove = async () => {
    setUploadingLogo(true);
    try {
      const { data: files } = await supabase.storage.from("org-logos").list(activeOrgId);
      if (files && files.length > 0) {
        await supabase.storage.from("org-logos").remove(files.map(f => `${activeOrgId}/${f.name}`));
      }
      const { error } = await supabase.from("organizations").update({ logo_url: null } as any).eq("id", activeOrgId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["org-details"] });
      queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
      toast.success("Logo removido!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <LexCard hover={false}>
      <LexCardHeader>
        <LexCardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" /> Dados Gerais
        </LexCardTitle>
      </LexCardHeader>
      <div className="space-y-4">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Avatar className="h-16 w-16">
              {org?.logo_url && <AvatarImage src={org.logo_url} alt={org?.name} />}
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                {(org?.name || "O").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {isOwnerOrAdmin && (
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {uploadingLogo ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
              </button>
            )}
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>
          <div>
            <p className="text-body-sm font-medium">{org?.name || "Organização"}</p>
            <p className="text-caption text-muted-foreground">
              {isOwnerOrAdmin ? "Clique no avatar para alterar o logo" : "Logo da organização"}
            </p>
            {isOwnerOrAdmin && org?.logo_url && (
              <button onClick={handleLogoRemove} disabled={uploadingLogo} className="text-caption text-destructive hover:underline mt-1">
                Remover logo
              </button>
            )}
          </div>
        </div>

        <Separator />

        <div>
          <label className="text-overline text-muted-foreground block mb-1.5">Nome da Organização</label>
          <Input className="bg-muted border-border rounded-xl max-w-md" value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={!isOwnerOrAdmin} />
        </div>

        <div className="flex items-center gap-2">
          <LexBadge variant={plan === "enterprise" ? "ai" : plan === "pro" ? "success" : plan === "trial" ? "warning" : "default"}>
            <Crown className="h-3 w-3" /> {PLAN_LABELS[plan]}
          </LexBadge>
          {isTrial && trialDaysLeft !== null && (
            <span className="text-caption text-warning">{trialDaysLeft} dias restantes</span>
          )}
        </div>

        {isOwnerOrAdmin && (
          <Button onClick={() => updateOrgMutation.mutate()} disabled={updateOrgMutation.isPending}>
            <Save className="h-4 w-4" /> {updateOrgMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        )}
      </div>
    </LexCard>
  );
};
