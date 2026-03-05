import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions, ROLE_LABELS } from "@/hooks/usePermissions";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { LexLogo } from "@/components/lexia/LexLogo";
import {
  LayoutDashboard, Scale, MessageSquare, LogOut, ChevronLeft, ChevronRight, Sparkles, UserCircle, FileText, CalendarDays, Shield, Building2, DollarSign, Settings, Users, Wand2, Clock, Gavel, GitCommitHorizontal, BookTemplate, Library, Zap, ScrollText, UsersRound, BarChart3, Calendar, Mail, Brain, ClipboardList, ShieldCheck, ShieldAlert, Plug, BellRing, TrendingUp, GitBranch, Ticket, BookOpen, Timer, FileSearch, AlertTriangle, PenLine, PieChart, MessageSquareText, KeyRound, Target, Landmark, Lock, Package, Building, Bot, BookText,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
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
  { title: "Audiências", url: "/hearings", icon: Gavel, permissions: ["VIEW_HEARINGS"] },
  { title: "Movimentações", url: "/movements", icon: GitCommitHorizontal, permissions: ["VIEW_PROCESSES"] },
  { title: "Documentos", url: "/documents", icon: FileText, permissions: ["VIEW_DOCUMENTS"] },
  { title: "Modelos", url: "/templates", icon: BookTemplate, permissions: ["VIEW_DOCUMENTS"] },
  { title: "Biblioteca", url: "/legal-references", icon: Library, permissions: ["VIEW_LEGAL_REFS"] },
  { title: "Tribunais", url: "/court-integrations", icon: Building2, permissions: ["MANAGE_PROCESSES"] },
  { title: "Monitoramento", url: "/court-monitoring", icon: Eye, permissions: ["VIEW_COURT_MONITORING"] },
  { title: "Legislação", url: "/legislative-updates", icon: ScrollText, permissions: ["VIEW_LEGISLATIVE_UPDATES"] },
  { title: "Regulatório", url: "/regulatory", icon: ShieldCheck, permissions: ["VIEW_REGULATORY"] },
  { title: "Clientes", url: "/clients", icon: Users, permissions: ["VIEW_CLIENTS"] },
  { title: "Chat IA", url: "/chat", icon: MessageSquare, accent: true, permissions: ["USE_IA_BASIC"] },
  { title: "IA Jurídica", url: "/ai-legal", icon: Wand2, accent: true, permissions: ["USE_IA_ADVANCED"] },
  { title: "Minutas", url: "/drafts", icon: FileText, accent: true, permissions: ["USE_IA_ADVANCED"] },
  { title: "Glossário", url: "/legal-glossary", icon: BookText, permissions: ["USE_IA_ADVANCED"] },
  { title: "Comparar Textos", url: "/text-comparison", icon: FileText, accent: true, permissions: ["USE_IA_ADVANCED"] },
  { title: "Contratos", url: "/contracts", icon: ScrollText, permissions: ["VIEW_CONTRACTS"] },
  { title: "Financeiro", url: "/financial", icon: DollarSign, permissions: ["VIEW_FINANCIAL"] },
  { title: "Horas", url: "/timesheet", icon: Clock, permissions: ["VIEW_PROCESSES"] },
  { title: "Times", url: "/teams", icon: UsersRound, permissions: ["VIEW_TEAMS"] },
  { title: "Produtividade", url: "/metrics", icon: BarChart3, permissions: ["VIEW_METRICS"] },
  { title: "Agenda", url: "/agenda", icon: Calendar, permissions: ["VIEW_AGENDA"] },
  { title: "Comunicações", url: "/communications", icon: Mail, permissions: ["VIEW_EXTERNAL_MESSAGES"] },
  { title: "Templates IA", url: "/ai-templates", icon: Brain, accent: true, permissions: ["VIEW_AI_TEMPLATES"] },
  { title: "Automações", url: "/automations", icon: Zap, permissions: ["VIEW_AUTOMATIONS"] },
  { title: "Relatórios", url: "/reports", icon: ClipboardList, permissions: ["VIEW_REPORTS"] },
  { title: "ACL", url: "/acl", icon: ShieldCheck, permissions: ["MANAGE_ACL"] },
  { title: "Compliance", url: "/compliance", icon: ShieldAlert, permissions: ["VIEW_COMPLIANCE"] },
  { title: "Integrações", url: "/integrations", icon: Plug, permissions: ["MANAGE_INTEGRATIONS"] },
  { title: "Regras Notif.", url: "/notification-rules", icon: BellRing, permissions: ["MANAGE_NOTIFICATION_RULES"] },
  { title: "IA Preditiva", url: "/predictions", icon: TrendingUp, accent: true, permissions: ["VIEW_PREDICTIONS"] },
  { title: "Workflows", url: "/workflows", icon: GitBranch, permissions: ["VIEW_WORKFLOWS"] },
  { title: "Tickets", url: "/tickets", icon: Ticket, permissions: ["VIEW_TICKETS"] },
  { title: "Wiki", url: "/wiki", icon: BookOpen, permissions: ["VIEW_WIKI"] },
  { title: "SLA", url: "/sla", icon: Timer, permissions: ["VIEW_SLA"] },
  { title: "Auditoria", url: "/audit-logs", icon: FileSearch, permissions: ["VIEW_AUDIT_ADVANCED"] },
  { title: "Riscos", url: "/risks", icon: AlertTriangle, permissions: ["VIEW_RISKS"] },
  { title: "Assinaturas", url: "/signatures", icon: PenLine, permissions: ["VIEW_SIGNATURES"] },
  { title: "Rel. Financeiros", url: "/financial-reports", icon: PieChart, permissions: ["VIEW_FINANCIAL_REPORTS"] },
  { title: "Templates Msg", url: "/communication-templates", icon: MessageSquareText, permissions: ["VIEW_COMMUNICATION_TEMPLATES"] },
  { title: "OKRs & KPIs", url: "/okrs", icon: Target, permissions: ["VIEW_OKRS"] },
  { title: "Governança", url: "/governance", icon: Landmark, permissions: ["VIEW_GOVERNANCE"] },
  { title: "Cofre Seguro", url: "/vault", icon: Lock, permissions: ["MANAGE_VAULT"] },
  { title: "Secrets", url: "/secret-manager", icon: KeyRound, permissions: ["MANAGE_SECRETS"] },
  { title: "Relatórios IA", url: "/ai-reports", icon: Brain, accent: true, permissions: ["VIEW_AI_REPORTS"] },
  { title: "Logs Segurança", url: "/security-logs", icon: ShieldAlert, permissions: ["VIEW_SECURITY_LOGS"] },
  { title: "Inventário", url: "/assets", icon: Package, permissions: ["VIEW_ASSETS"] },
  { title: "Fornecedores", url: "/vendors", icon: Building, permissions: ["VIEW_VENDORS"] },
  { title: "Chatbot IA", url: "/legal-chatbot", icon: Bot, accent: true, permissions: ["USE_CHATBOT"] },
  { title: "Organização", url: "/organization", icon: Building2, permissions: ["MANAGE_ORGANIZATION", "VIEW_USERS", "VIEW_PROCESSES"] },
  { title: "Admin", url: "/admin", icon: Shield, permissions: ["MANAGE_USERS"] },
  { title: "Plano & Uso", url: "/settings", icon: Settings, permissions: ["MANAGE_ORGANIZATION"] },
  { title: "Perfil", url: "/profile", icon: UserCircle },
];

export const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { signOut, user } = useAuth();
  const { activeOrgId, organizations } = useOrganization();
  const { role, hasAnyPermission, isClient } = usePermissions();
  const navigate = useNavigate();

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
      // Clients already get portal injected above, skip the navItems version
      if (isClient && item.url === "/portal") return false;
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
        {/* Org switcher */}
        <OrgSwitcher collapsed={collapsed} />
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
