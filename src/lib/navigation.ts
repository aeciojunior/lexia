import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Scale,
  Columns3,
  CalendarDays,
  Gavel,
  GitCommitHorizontal,
  Clock,
  FileText,
  BookTemplate,
  Library,
  PenLine,
  Building2,
  Eye,
  ScrollText,
  ShieldCheck,
  Brain,
  BookOpen,
  Target,
  TrendingUp,
  GitBranch,
  DollarSign,
  FileSearch,
  Users,
  UsersRound,
  MessageSquare,
  Wand2,
  BookText,
  ScrollText as ContractIcon,
  Mail,
  MessageSquareText,
  Ticket,
  BarChart3,
  Calendar,
  Zap,
  ClipboardList,
  Timer,
  ShieldAlert,
  Plug,
  BellRing,
  AlertTriangle,
  PieChart,
  Landmark,
  Lock,
  KeyRound,
  Package,
  Building,
  Bot,
  Shield,
  Settings,
  UserCircle,
  Sparkles,
} from "lucide-react";
import type { Permission } from "@/hooks/usePermissions";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  accent?: boolean;
  permissions?: Permission[];
  keywords?: string[];
}

export interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  items: NavItem[];
  /** Always visible (e.g. Início) */
  defaultOpen?: boolean;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "inicio",
    label: "Início",
    icon: LayoutDashboard,
    defaultOpen: true,
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    id: "processos",
    label: "Processos & Prazos",
    icon: Scale,
    description: "Gestão operacional do contencioso",
    defaultOpen: true,
    items: [
      { title: "Processos", url: "/processes", icon: Scale, permissions: ["VIEW_PROCESSES"], keywords: ["lista", "cnj"] },
      { title: "Kanban", url: "/processes/kanban", icon: Columns3, permissions: ["VIEW_PROCESSES"], keywords: ["board", "fase"] },
      { title: "Prazos", url: "/deadlines", icon: CalendarDays, permissions: ["VIEW_TASKS"] },
      { title: "Audiências", url: "/hearings", icon: Gavel, permissions: ["VIEW_HEARINGS"] },
      { title: "Movimentações", url: "/movements", icon: GitCommitHorizontal, permissions: ["VIEW_PROCESSES"] },
      { title: "Horas", url: "/timesheet", icon: Clock, permissions: ["VIEW_PROCESSES"] },
    ],
  },
  {
    id: "documentos",
    label: "Documentos",
    icon: FileText,
    description: "Arquivos, modelos e assinaturas",
    items: [
      { title: "Documentos", url: "/documents", icon: FileText, permissions: ["VIEW_DOCUMENTS"] },
      { title: "Modelos", url: "/templates", icon: BookTemplate, permissions: ["VIEW_DOCUMENTS"] },
      { title: "Biblioteca", url: "/legal-references", icon: Library, permissions: ["VIEW_LEGAL_REFS"] },
      { title: "Assinaturas", url: "/signatures", icon: PenLine, permissions: ["VIEW_SIGNATURES"] },
      { title: "Comparar Textos", url: "/text-comparison", icon: FileText, accent: true, permissions: ["USE_IA_ADVANCED"] },
    ],
  },
  {
    id: "tribunais",
    label: "Tribunais & Normas",
    icon: Building2,
    description: "Integrações e monitoramento",
    items: [
      { title: "Tribunais", url: "/court-integrations", icon: Building2, permissions: ["MANAGE_PROCESSES"] },
      { title: "Monitoramento", url: "/court-monitoring", icon: Eye, permissions: ["VIEW_COURT_MONITORING"] },
      { title: "Legislação", url: "/legislative-updates", icon: ScrollText, permissions: ["VIEW_LEGISLATIVE_UPDATES"] },
      { title: "Regulatório", url: "/regulatory", icon: ShieldCheck, permissions: ["VIEW_REGULATORY"] },
    ],
  },
  {
    id: "inteligencia",
    label: "Inteligência Jurídica",
    icon: Brain,
    description: "Análises, precedentes e previsões",
    items: [
      { title: "Inteligência", url: "/legal-intelligence", icon: Brain, accent: true, permissions: ["VIEW_LEGAL_INTELLIGENCE"] },
      { title: "Precedentes", url: "/precedents", icon: BookOpen, permissions: ["VIEW_INTERNAL_PRECEDENTS"] },
      { title: "Estratégia", url: "/legal-strategy", icon: Target, accent: true, permissions: ["VIEW_LEGAL_STRATEGY"] },
      { title: "Previsões", url: "/process-predictions", icon: TrendingUp, accent: true, permissions: ["VIEW_PREDICTIONS"] },
      { title: "Clusters", url: "/case-clustering", icon: GitBranch, permissions: ["VIEW_CASE_CLUSTERING"] },
      { title: "Due Diligence", url: "/due-diligence", icon: FileSearch, accent: true, permissions: ["VIEW_DUE_DILIGENCE"] },
      { title: "Litígios Repetitivos", url: "/mass-litigation", icon: Users, permissions: ["VIEW_MASS_LITIGATION"] },
      { title: "IA Preditiva", url: "/predictions", icon: TrendingUp, accent: true, permissions: ["VIEW_PREDICTIONS"] },
    ],
  },
  {
    id: "ia",
    label: "Inteligência Artificial",
    icon: Sparkles,
    description: "Assistentes e automação cognitiva",
    items: [
      { title: "Chat IA", url: "/chat", icon: MessageSquare, accent: true, permissions: ["USE_IA_BASIC"] },
      { title: "IA Jurídica", url: "/ai-legal", icon: Wand2, accent: true, permissions: ["USE_IA_ADVANCED"] },
      { title: "Minutas", url: "/drafts", icon: FileText, accent: true, permissions: ["USE_IA_ADVANCED"] },
      { title: "Glossário", url: "/legal-glossary", icon: BookText, permissions: ["USE_IA_ADVANCED"] },
      { title: "Templates IA", url: "/ai-templates", icon: Brain, accent: true, permissions: ["VIEW_AI_TEMPLATES"] },
      { title: "Chatbot IA", url: "/legal-chatbot", icon: Bot, accent: true, permissions: ["USE_CHATBOT"] },
      { title: "Relatórios IA", url: "/ai-reports", icon: Brain, accent: true, permissions: ["VIEW_AI_REPORTS"] },
    ],
  },
  {
    id: "clientes",
    label: "Clientes & Relacionamento",
    icon: Users,
    description: "CRM jurídico e atendimento",
    items: [
      { title: "Clientes", url: "/clients", icon: Users, permissions: ["VIEW_CLIENTS"] },
      { title: "Contratos", url: "/contracts", icon: ContractIcon, permissions: ["VIEW_CONTRACTS"] },
      { title: "Comunicações", url: "/communications", icon: Mail, permissions: ["VIEW_EXTERNAL_MESSAGES"] },
      { title: "Templates de Mensagens", url: "/communication-templates", icon: MessageSquareText, permissions: ["VIEW_COMMUNICATION_TEMPLATES"] },
      { title: "Tickets", url: "/tickets", icon: Ticket, permissions: ["VIEW_TICKETS"] },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro & Performance",
    icon: DollarSign,
    description: "Receitas, custos e indicadores",
    items: [
      { title: "Financeiro", url: "/financial", icon: DollarSign, permissions: ["VIEW_FINANCIAL"] },
      { title: "Impacto Financeiro", url: "/financial-impact", icon: DollarSign, accent: true, permissions: ["VIEW_FINANCIAL_IMPACT"] },
      { title: "Relatórios Financeiros", url: "/financial-reports", icon: PieChart, permissions: ["VIEW_FINANCIAL_REPORTS"] },
      { title: "Produtividade", url: "/metrics", icon: BarChart3, permissions: ["VIEW_METRICS"] },
      { title: "OKRs & KPIs", url: "/okrs", icon: Target, permissions: ["VIEW_OKRS"] },
    ],
  },
  {
    id: "operacoes",
    label: "Operações & Equipe",
    icon: Calendar,
    description: "Agenda, fluxos e conhecimento",
    items: [
      { title: "Agenda", url: "/agenda", icon: Calendar, permissions: ["VIEW_AGENDA"] },
      { title: "Times", url: "/teams", icon: UsersRound, permissions: ["VIEW_TEAMS"] },
      { title: "Automações", url: "/automations", icon: Zap, permissions: ["VIEW_AUTOMATIONS"] },
      { title: "Workflows", url: "/workflows", icon: GitBranch, permissions: ["VIEW_WORKFLOWS"] },
      { title: "Relatórios", url: "/reports", icon: ClipboardList, permissions: ["VIEW_REPORTS"] },
      { title: "Wiki", url: "/wiki", icon: BookOpen, permissions: ["VIEW_WIKI"] },
      { title: "SLA", url: "/sla", icon: Timer, permissions: ["VIEW_SLA"] },
    ],
  },
  {
    id: "governanca",
    label: "Governança & Compliance",
    icon: ShieldCheck,
    description: "Controles, riscos e auditoria",
    items: [
      { title: "ACL", url: "/acl", icon: ShieldCheck, permissions: ["MANAGE_ACL"] },
      { title: "Compliance", url: "/compliance", icon: ShieldAlert, permissions: ["VIEW_COMPLIANCE"] },
      { title: "Auditoria", url: "/audit-logs", icon: FileSearch, permissions: ["VIEW_AUDIT_ADVANCED"] },
      { title: "Riscos", url: "/risks", icon: AlertTriangle, permissions: ["VIEW_RISKS"] },
      { title: "Governança", url: "/governance", icon: Landmark, permissions: ["VIEW_GOVERNANCE"] },
      { title: "Logs Segurança", url: "/security-logs", icon: ShieldAlert, permissions: ["VIEW_SECURITY_LOGS"] },
    ],
  },
  {
    id: "seguranca",
    label: "Segurança & Integrações",
    icon: Lock,
    description: "Proteção de dados e conectores",
    items: [
      { title: "Cofre Seguro", url: "/vault", icon: Lock, permissions: ["MANAGE_VAULT"] },
      { title: "Secrets", url: "/secret-manager", icon: KeyRound, permissions: ["MANAGE_SECRETS"] },
      { title: "Integrações", url: "/integrations", icon: Plug, permissions: ["MANAGE_INTEGRATIONS"] },
      { title: "Regras de Notificação", url: "/notification-rules", icon: BellRing, permissions: ["MANAGE_NOTIFICATION_RULES"] },
    ],
  },
  {
    id: "ativos",
    label: "Ativos & Fornecedores",
    icon: Package,
    items: [
      { title: "Inventário", url: "/assets", icon: Package, permissions: ["VIEW_ASSETS"] },
      { title: "Fornecedores", url: "/vendors", icon: Building, permissions: ["VIEW_VENDORS"] },
    ],
  },
  {
    id: "conta",
    label: "Conta & Configurações",
    icon: Settings,
    description: "Perfil, organização e plano",
    defaultOpen: false,
    items: [
      { title: "Organização", url: "/organization", icon: Building2, permissions: ["MANAGE_ORGANIZATION", "VIEW_USERS", "VIEW_PROCESSES"] },
      { title: "Admin", url: "/admin", icon: Shield, permissions: ["MANAGE_USERS"] },
      { title: "Plano & Uso", url: "/settings", icon: Settings, permissions: ["MANAGE_ORGANIZATION"] },
      { title: "Perfil", url: "/profile", icon: UserCircle },
      { title: "Design System", url: "/design-system", icon: Sparkles, keywords: ["wiki", "documentação", "ui", "tokens"] },
    ],
  },
];

export const CLIENT_PORTAL_ITEM: NavItem = {
  title: "Portal",
  url: "/portal",
  icon: Shield,
};

export function filterNavItem(
  item: NavItem,
  hasAnyPermission: (...perms: Permission[]) => boolean,
  isClient: boolean,
): boolean {
  if (isClient) {
    return item.url === "/profile" || item.url === "/portal";
  }
  if (!item.permissions) return true;
  return hasAnyPermission(...item.permissions);
}

export function getVisibleNavGroups(
  hasAnyPermission: (...perms: Permission[]) => boolean,
  isClient: boolean,
): NavGroup[] {
  if (isClient) {
    return [
      {
        id: "portal",
        label: "Portal",
        icon: Shield,
        defaultOpen: true,
        items: [CLIENT_PORTAL_ITEM, { title: "Perfil", url: "/profile", icon: UserCircle }],
      },
    ];
  }

  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => filterNavItem(item, hasAnyPermission, isClient)),
  })).filter((group) => group.items.length > 0);
}

export function findActiveGroupId(pathname: string, groups: NavGroup[]): string | null {
  for (const group of groups) {
    if (group.items.some((item) => pathname === item.url || (item.url !== "/dashboard" && pathname.startsWith(item.url + "/")))) {
      return group.id;
    }
  }
  return null;
}

export function flattenNavItems(groups: NavGroup[]): NavItem[] {
  return groups.flatMap((g) => g.items);
}
