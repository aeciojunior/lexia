import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Processes from "./pages/Processes";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import Documents from "./pages/Documents";
import Deadlines from "./pages/Deadlines";
import Admin from "./pages/Admin";
import Organization from "./pages/Organization";
import InviteAccept from "./pages/InviteAccept";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import NoOrganization from "./pages/NoOrganization";
import ClientPortal from "./pages/ClientPortal";
import Financial from "./pages/Financial";
import Clients from "./pages/Clients";
import AILegalDocs from "./pages/AILegalDocs";
import Settings from "./pages/Settings";
import ResetPassword from "./pages/ResetPassword";
import Timesheet from "./pages/Timesheet";
import Hearings from "./pages/Hearings";
import Movements from "./pages/Movements";
import DocumentTemplates from "./pages/DocumentTemplates";
import LegalReferences from "./pages/LegalReferences";
import CourtIntegrations from "./pages/CourtIntegrations";
import Automations from "./pages/Automations";
import Contracts from "./pages/Contracts";
import Teams from "./pages/Teams";
import Metrics from "./pages/Metrics";
import Agenda from "./pages/Agenda";
import Communications from "./pages/Communications";
import AITemplates from "./pages/AITemplates";
import Reports from "./pages/Reports";
import ACLPermissions from "./pages/ACLPermissions";
import Compliance from "./pages/Compliance";
import Integrations from "./pages/Integrations";
import NotificationRules from "./pages/NotificationRules";
import Predictions from "./pages/Predictions";
import Workflows from "./pages/Workflows";
import Tickets from "./pages/Tickets";
import Wiki from "./pages/Wiki";
import SLA from "./pages/SLA";
import AuditLogs from "./pages/AuditLogs";
import Risks from "./pages/Risks";
import Signatures from "./pages/Signatures";
import FinancialReports from "./pages/FinancialReports";
import CommunicationTemplates from "./pages/CommunicationTemplates";
import NotFound from "./pages/NotFound";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<Landing />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/processes" element={<Processes />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/deadlines" element={<Deadlines />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/organization" element={<Organization />} />
              <Route path="/financial" element={<Financial />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/ai-legal" element={<AILegalDocs />} />
              <Route path="/portal" element={<ClientPortal />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/timesheet" element={<Timesheet />} />
              <Route path="/hearings" element={<Hearings />} />
              <Route path="/movements" element={<Movements />} />
              <Route path="/templates" element={<DocumentTemplates />} />
              <Route path="/legal-references" element={<LegalReferences />} />
              <Route path="/court-integrations" element={<CourtIntegrations />} />
              <Route path="/automations" element={<Automations />} />
              <Route path="/contracts" element={<Contracts />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/metrics" element={<Metrics />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/communications" element={<Communications />} />
              <Route path="/ai-templates" element={<AITemplates />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/acl" element={<ACLPermissions />} />
              <Route path="/compliance" element={<Compliance />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/notification-rules" element={<NotificationRules />} />
              <Route path="/predictions" element={<Predictions />} />
              <Route path="/workflows" element={<Workflows />} />
              <Route path="/tickets" element={<Tickets />} />
              <Route path="/wiki" element={<Wiki />} />
              <Route path="/sla" element={<SLA />} />
              <Route path="/audit-logs" element={<AuditLogs />} />
              <Route path="/risks" element={<Risks />} />
              <Route path="/signatures" element={<Signatures />} />
              <Route path="/financial-reports" element={<FinancialReports />} />
              <Route path="/communication-templates" element={<CommunicationTemplates />} />
            </Route>
            <Route path="/invite/:token" element={<InviteAccept />} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/no-organization" element={<ProtectedRoute><NoOrganization /></ProtectedRoute>} />
            <Route path="/design-system" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
