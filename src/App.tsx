import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { useAppStore } from "@/store/useAppStore";
import { setupStoreSync } from "@/lib/supabaseData";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ClientsPage from "./pages/ClientsPage";
import ClientDetailPage from "./pages/ClientDetailPage";
import TasksPage from "./pages/TasksPage";
import ProspectionPage from "./pages/ProspectionPage";
import ProposalsPage from "./pages/ProposalsPage";
import FinancialPage from "./pages/FinancialPage";
import OnboardingPage from "./pages/OnboardingPage";
import TrafficPage from "./pages/TrafficPage";
import SocialMediaPage from "./pages/SocialMediaPage";
import SocialDashboardPage from "./pages/SocialDashboardPage";
import ClientApprovalPage from "./pages/ClientApprovalPage";
import ProductionPage from "./pages/ProductionPage";
import TechPage from "./pages/TechPage";
import InsideSalesPage from "./pages/InsideSalesPage";
import ApprovalsPage from "./pages/ApprovalsPage";
import AdHocPage from "./pages/AdHocPage";
import RecurrencesPage from "./pages/RecurrencesPage";
import AIAlertsPage from "./pages/AIAlertsPage";
import DashboardOpsPage from "./pages/DashboardOpsPage";
import DashboardFinancialPage from "./pages/DashboardFinancialPage";
import WorkloadPage from "./pages/WorkloadPage";
import AdminPage from "./pages/AdminPage";
import AuditPage from "./pages/AuditPage";
import SettingsPage from "./pages/SettingsPage";
import QuoteRequestsPage from "./pages/QuoteRequestsPage";
import RequestsPage from "./pages/RequestsPage";
import HelpCenterPage from "./pages/HelpCenterPage";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();
const DEFAULT_MODULES = ["dashboard", "clients", "tasks", "requests", "ad-hoc"];

function ProtectedRoute({ children, moduleKey }: { children: React.ReactNode; moduleKey: string }) {
  const currentUser = useAuthStore((s) => s.currentUser);
  if (currentUser?.isAdmin) return <>{children}</>;
  const access = currentUser?.moduleAccess || DEFAULT_MODULES;
  if (!access.includes(moduleKey)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AuthenticatedApp() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const isLoading = useAuthStore((s) => s.isLoading);
  const initialized = useAuthStore((s) => s.initialized);
  const initAuth = useAuthStore((s) => s.initAuth);
  const loadFromDB = useAppStore((s) => s.loadFromDB);
  const resetAppStore = useAppStore((s) => s.reset);
  const [dataLoaded, setDataLoaded] = useState(false);
  const syncUnsubRef = useRef<(() => void) | null>(null);
  const prevUserRef = useRef<string | null>(null);

  useEffect(() => {
    initAuth();
  }, []);

  // Reset state when user changes (logout or different user)
  useEffect(() => {
    const userId = currentUser?.authId || null;
    if (prevUserRef.current && prevUserRef.current !== userId) {
      // User changed or logged out - reset everything
      if (syncUnsubRef.current) {
        syncUnsubRef.current();
        syncUnsubRef.current = null;
      }
      resetAppStore();
      setDataLoaded(false);
    }
    prevUserRef.current = userId;
  }, [currentUser?.authId]);

  // Load data from DB when authenticated and data not yet loaded
  useEffect(() => {
    if (currentUser && !dataLoaded) {
      loadFromDB().then(() => {
        setDataLoaded(true);
        // Setup sync AFTER data is loaded (not before!)
        if (syncUnsubRef.current) {
          syncUnsubRef.current();
        }
        syncUnsubRef.current = setupStoreSync(useAppStore.subscribe, useAppStore.getState);
      });
    }

    return () => {
      // Cleanup sync on unmount
      if (syncUnsubRef.current) {
        syncUnsubRef.current();
        syncUnsubRef.current = null;
      }
    };
  }, [currentUser, dataLoaded]);

  // Realtime subscription: reload data instantly when any team member makes changes
  useEffect(() => {
    if (!currentUser || !dataLoaded) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { loadFromDB(); }, 1000);
    };

    const channel = supabase
      .channel('global-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_team_assignments' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_requests' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quote_requests' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_recurring_services' }, debouncedLoad)
      .subscribe();

    // Fallback polling every 2 minutes
    const interval = setInterval(() => { loadFromDB(); }, 120000);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [currentUser, dataLoaded]);

  if (isLoading || !initialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser) return <LoginPage />;

  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clients" element={<ProtectedRoute moduleKey="clients"><ClientsPage /></ProtectedRoute>} />
        <Route path="/clients/:id" element={<ProtectedRoute moduleKey="clients"><ClientDetailPage /></ProtectedRoute>} />
        <Route path="/tasks" element={<ProtectedRoute moduleKey="tasks"><TasksPage /></ProtectedRoute>} />
        <Route path="/prospection" element={<ProtectedRoute moduleKey="prospection"><ProspectionPage /></ProtectedRoute>} />
        <Route path="/proposals" element={<ProtectedRoute moduleKey="proposals"><ProposalsPage /></ProtectedRoute>} />
        <Route path="/financial" element={<ProtectedRoute moduleKey="financial"><FinancialPage /></ProtectedRoute>} />
        <Route path="/onboarding" element={<ProtectedRoute moduleKey="onboarding"><OnboardingPage /></ProtectedRoute>} />
        <Route path="/traffic" element={<ProtectedRoute moduleKey="traffic"><TrafficPage /></ProtectedRoute>} />
        <Route path="/social" element={<ProtectedRoute moduleKey="social"><SocialMediaPage /></ProtectedRoute>} />
        <Route path="/social-dashboard" element={<ProtectedRoute moduleKey="social"><SocialDashboardPage /></ProtectedRoute>} />
        <Route path="/production" element={<ProtectedRoute moduleKey="production"><ProductionPage /></ProtectedRoute>} />
        <Route path="/tech" element={<ProtectedRoute moduleKey="tech"><TechPage /></ProtectedRoute>} />
        <Route path="/inside-sales" element={<ProtectedRoute moduleKey="inside-sales"><InsideSalesPage /></ProtectedRoute>} />
        <Route path="/approvals" element={<ProtectedRoute moduleKey="approvals"><ApprovalsPage /></ProtectedRoute>} />
        <Route path="/ad-hoc" element={<ProtectedRoute moduleKey="ad-hoc"><AdHocPage /></ProtectedRoute>} />
        <Route path="/recurrences" element={<ProtectedRoute moduleKey="recurrences"><RecurrencesPage /></ProtectedRoute>} />
        <Route path="/ai-alerts" element={<ProtectedRoute moduleKey="ai-alerts"><AIAlertsPage /></ProtectedRoute>} />
        <Route path="/quote-requests" element={<ProtectedRoute moduleKey="quote-requests"><QuoteRequestsPage /></ProtectedRoute>} />
        <Route path="/requests" element={<ProtectedRoute moduleKey="requests"><RequestsPage /></ProtectedRoute>} />
        <Route path="/dashboard-executive" element={<DashboardPage />} />
        <Route path="/dashboard-ops" element={<ProtectedRoute moduleKey="dashboard-ops"><DashboardOpsPage /></ProtectedRoute>} />
        <Route path="/dashboard-financial" element={<ProtectedRoute moduleKey="dashboard-financial"><DashboardFinancialPage /></ProtectedRoute>} />
        <Route path="/dashboard-workload" element={<ProtectedRoute moduleKey="workload"><WorkloadPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute moduleKey="admin"><AdminPage /></ProtectedRoute>} />
        <Route path="/audit" element={<ProtectedRoute moduleKey="audit"><AuditPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute moduleKey="settings"><SettingsPage /></ProtectedRoute>} />
        <Route path="/help" element={<HelpCenterPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/approve/:token" element={<ClientApprovalPage />} />
          <Route path="/*" element={<AuthenticatedApp />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
