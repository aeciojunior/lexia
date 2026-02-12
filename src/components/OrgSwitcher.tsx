import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions, ROLE_LABELS, ROLE_BADGE_VARIANT } from "@/hooks/usePermissions";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";
import { toast } from "sonner";
import type { OrgRole } from "@/hooks/usePermissions";

export const OrgSwitcher = ({ collapsed = false }: { collapsed?: boolean }) => {
  const { activeOrgId, organizations, switchOrganization } = useOrganization();
  const { role } = usePermissions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  if (organizations.length === 0) return null;

  const activeOrg = organizations.find(
    (o: any) => o.organization_id === activeOrgId
  );
  const activeOrgName = (activeOrg as any)?.organizations?.name || "Organização";

  const handleSwitch = async (orgId: string) => {
    if (orgId === activeOrgId || switching) return;
    setSwitching(true);
    try {
      await switchOrganization(orgId);
      await queryClient.invalidateQueries();
      const orgName = organizations.find(
        (o: any) => o.organization_id === orgId
      ) as any;
      toast.success(`Organização alterada para ${orgName?.organizations?.name || "nova organização"}`);
    } catch {
      toast.error("Erro ao trocar de organização");
    } finally {
      setSwitching(false);
      setOpen(false);
    }
  };

  if (collapsed) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <Building2 className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className="w-64 p-2">
          <OrgList
            organizations={organizations}
            activeOrgId={activeOrgId}
            switching={switching}
            onSwitch={handleSwitch}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between px-3 py-2.5 h-auto text-left hover:bg-sidebar-accent"
          disabled={switching}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">
                {activeOrgName}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {ROLE_LABELS[role] || role}
              </p>
            </div>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-64 p-2">
        <p className="text-overline text-muted-foreground px-2 py-1.5">
          Suas organizações
        </p>
        <OrgList
          organizations={organizations}
          activeOrgId={activeOrgId}
          switching={switching}
          onSwitch={handleSwitch}
        />
      </PopoverContent>
    </Popover>
  );
};

function OrgList({
  organizations,
  activeOrgId,
  switching,
  onSwitch,
}: {
  organizations: any[];
  activeOrgId: string | null;
  switching: boolean;
  onSwitch: (id: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      {organizations.map((o: any) => {
        const isActive = o.organization_id === activeOrgId;
        const orgRole = o.role as OrgRole;
        return (
          <button
            key={o.organization_id}
            onClick={() => onSwitch(o.organization_id)}
            disabled={switching || isActive}
            className={`w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
            } disabled:opacity-70`}
          >
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-medium truncate">
                {o.organizations?.name || "Organização"}
              </p>
            </div>
            <Badge
              variant={ROLE_BADGE_VARIANT[orgRole] as any}
              className="text-[10px] px-1.5 py-0"
            >
              {ROLE_LABELS[orgRole] || orgRole}
            </Badge>
            {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
          </button>
        );
      })}
    </div>
  );
}
