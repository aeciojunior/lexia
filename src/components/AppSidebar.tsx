import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions, ROLE_LABELS } from "@/hooks/usePermissions";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { LexLogo } from "@/components/lexia/LexLogo";
import { SidebarNav, SidebarSearch, getVisibleNavGroups } from "@/components/SidebarNav";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronLeft, ChevronRight, LogOut, Menu } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export const AppSidebar = ({ mobileOpen, onMobileOpenChange }: AppSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const { signOut, user } = useAuth();
  const { hasAnyPermission, role, isClient } = usePermissions();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const visibleGroups = useMemo(
    () => getVisibleNavGroups(hasAnyPermission, isClient),
    [hasAnyPermission, isClient],
  );

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const sidebarFooter = (
    <div className="shrink-0 border-t border-sidebar-border space-y-2 p-3 bg-sidebar/80 backdrop-blur-sm">
      <OrgSwitcher collapsed={collapsed && !isMobile} />
      {!collapsed && user && (
        <div className="px-2.5 py-2 rounded-lg bg-sidebar-accent/30">
          <p className="text-xs font-semibold text-sidebar-foreground truncate">{user.email}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">
            {ROLE_LABELS[role] || role}
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={handleSignOut}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
          "text-muted-foreground hover:bg-sidebar-accent hover:text-destructive transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40",
          collapsed && !isMobile && "justify-center",
        )}
      >
        <LogOut className="h-4 w-4 shrink-0" />
        {(!collapsed || isMobile) && <span>Sair</span>}
      </button>
    </div>
  );

  const sidebarInner = (
    <>
      <div className="shrink-0 flex items-center justify-between p-4 h-16 border-b border-sidebar-border/60">
        {(!collapsed || isMobile) && <LexLogo size="sm" />}
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8 shrink-0"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>

      <SidebarSearch value={search} onChange={setSearch} collapsed={collapsed && !isMobile} />

      <ScrollArea className="flex-1 px-2">
        <nav className="py-2 pr-2" aria-label="Navegação principal">
          <SidebarNav
            groups={visibleGroups}
            collapsed={collapsed && !isMobile}
            searchQuery={search}
            onNavigate={() => onMobileOpenChange?.(false)}
          />
        </nav>
      </ScrollArea>

      {sidebarFooter}
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="left"
          className="w-[min(320px,88vw)] p-0 bg-sidebar text-sidebar-foreground border-sidebar-border flex flex-col"
        >
          <TooltipProvider delayDuration={300}>{sidebarInner}</TooltipProvider>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        className={cn(
          "hidden md:flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-normal",
          "border-r border-sidebar-border relative shrink-0",
          collapsed ? "w-[72px]" : "w-72",
        )}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        {sidebarInner}
      </aside>
    </TooltipProvider>
  );
};

/** Botão para abrir menu mobile — usar no header */
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="icon"
      className="md:hidden h-9 w-9 rounded-xl border-border/60"
      onClick={onClick}
      aria-label="Abrir menu"
    >
      <Menu className="h-4 w-4" />
    </Button>
  );
};
