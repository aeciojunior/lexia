import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions, ROLE_LABELS } from "@/hooks/usePermissions";
import { LexLogo } from "@/components/lexia/LexLogo";
import {
  LayoutDashboard, Scale, MessageSquare, LogOut, ChevronLeft, ChevronRight, Sparkles, UserCircle, FileText, CalendarDays, Shield, Building2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { Permission } from "@/hooks/usePermissions";

interface NavItem {
  title: string;
  url: string;
  icon: any;
  accent?: boolean;
  /** At least one of these permissions required to show */
  permissions?: Permission[];
}

const navItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Processos", url: "/processes", icon: Scale, permissions: ["VIEW_PROCESSES"] },
  { title: "Prazos", url: "/deadlines", icon: CalendarDays, permissions: ["VIEW_TASKS"] },
  { title: "Documentos", url: "/documents", icon: FileText, permissions: ["VIEW_DOCUMENTS"] },
  { title: "Chat IA", url: "/chat", icon: MessageSquare, accent: true, permissions: ["USE_IA_BASIC"] },
  { title: "Organização", url: "/organization", icon: Building2, permissions: ["MANAGE_ORGANIZATION", "VIEW_USERS"] },
  { title: "Admin", url: "/admin", icon: Shield, permissions: ["MANAGE_USERS"] },
  
  { title: "Perfil", url: "/profile", icon: UserCircle },
];

export const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { signOut, user } = useAuth();
  const { activeOrgId, organizations, switchOrganization } = useOrganization();
  const { role, hasAnyPermission, isClient } = usePermissions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const visibleItems = [
    // For clients, show Portal instead of Dashboard
    ...(isClient
      ? [{ title: "Portal", url: "/portal", icon: Shield } as NavItem]
      : []),
    ...navItems.filter((item) => {
      if (!item.permissions) return !isClient || item.url === "/profile";
      return hasAnyPermission(...item.permissions);
    }),
  ];

  return (
    <aside
      className={`flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-normal border-r border-sidebar-border relative ${
        collapsed ? "w-[72px]" : "w-64"
      }`}
    >
      {/* Ambient top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between p-4 h-16">
        {!collapsed && <LexLogo size="sm" />}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8 shrink-0"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {!collapsed && <p className="text-overline text-muted-foreground px-3 mb-3">Menu</p>}
        {visibleItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/dashboard"}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-normal ${collapsed ? "justify-center" : ""}`}
            activeClassName="bg-sidebar-accent text-sidebar-primary shadow-sm neon-border"
          >
            <item.icon className={`h-5 w-5 shrink-0 ${item.accent ? "text-secondary" : ""}`} />
            {!collapsed && <span>{item.title}</span>}
            {!collapsed && item.accent && (
              <Sparkles className="h-3 w-3 text-secondary ml-auto animate-pulse-glow" />
            )}
          </NavLink>
        ))}
      </nav>

      {/* User & Logout */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        {/* Org selector */}
        {!collapsed && organizations.length > 0 && (
          <div className="px-3 py-2">
            <p className="text-overline text-muted-foreground mb-1.5 flex items-center gap-1"><Building2 className="h-3 w-3" /> Organização</p>
            <select
              value={activeOrgId || ""}
              onChange={async (e) => {
                await switchOrganization(e.target.value);
                queryClient.invalidateQueries();
              }}
              className="w-full text-xs bg-sidebar-accent text-sidebar-foreground rounded-lg px-2 py-1.5 border border-sidebar-border"
            >
              {organizations.map((o: any) => (
                <option key={o.organization_id} value={o.organization_id}>
                  {o.organizations?.name || "Organização"}
                </option>
              ))}
            </select>
          </div>
        )}
        {!collapsed && user && (
          <div className="px-3 py-2">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">{user.email}</p>
            <p className="text-overline text-muted-foreground mt-0.5">{ROLE_LABELS[role] || role}</p>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-destructive transition-all ${collapsed ? "justify-center" : ""}`}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
};
