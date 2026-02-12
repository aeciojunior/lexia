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
