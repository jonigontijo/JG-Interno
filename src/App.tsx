import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { useAppStore } from "@/store/useAppStore";
import { supabase } from "@/integrations/supabase/client";
import React, { useEffect, useState, useRef, useCallback } from "react";
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
import ResetPasswordPage from "./pages/ResetPasswordPage";
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
  const reloadClients = useAppStore((s) => s.reloadClients);
  const reloadTasks = useAppStore((s) => s.reloadTasks);
  const reloadTeam = useAppStore((s) => s.reloadTeam);
  const reloadLeads = useAppStore((s) => s.reloadLeads);
  const reloadRequests = useAppStore((s) => s.reloadRequests);
  const reloadQuotes = useAppStore((s) => s.reloadQuotes);
  const resetAppStore = useAppStore((s) => s.reset);
  const [dataLoaded, setDataLoaded] = useState(false);
  const prevUserRef = useRef<string | null>(null);

  useEffect(() => {
    initAuth();
  }, []);

  useEffect(() => {
    const userId = currentUser?.authId || null;
    if (prevUserRef.current && prevUserRef.current !== userId) {
      resetAppStore();
      setDataLoaded(false);
    }
    prevUserRef.current = userId;
  }, [currentUser?.authId]);

  useEffect(() => {
    if (currentUser && !dataLoaded) {
      loadFromDB()
        .then(() => setDataLoaded(true))
        .catch((err) => {
          console.error('Failed to load data from DB:', err);
          setDataLoaded(true);
        });
    }
  }, [currentUser, dataLoaded]);

  const createDebouncedReload = useCallback(() => {
    const timers: Record<string, ReturnType<typeof setTimeout>> = {};
    return (table: string, reloadFn: () => Promise<void>) => {
      if (timers[table]) clearTimeout(timers[table]);
      timers[table] = setTimeout(() => { reloadFn(); }, 2000);
    };
  }, []);

  useEffect(() => {
    if (!currentUser || !dataLoaded) return;

    const debouncedReload = createDebouncedReload();

    const channel = supabase
      .channel('global-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        debouncedReload('clients', reloadClients);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_team_assignments' }, () => {
        debouncedReload('clients', reloadClients);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_recurring_services' }, () => {
        debouncedReload('clients', reloadClients);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        debouncedReload('tasks', reloadTasks);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, () => {
        debouncedReload('team', reloadTeam);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        debouncedReload('leads', reloadLeads);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_requests' }, () => {
        debouncedReload('requests', reloadRequests);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quote_requests' }, () => {
        debouncedReload('quotes', reloadQuotes);
      })
      .subscribe();

    const interval = setInterval(() => { loadFromDB(); }, 300000);

    return () => {
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

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: string; stack: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "", stack: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message, stack: error.stack || "" };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // #region agent log
    // eslint-disable-next-line no-console
    console.error('[DBG ERR-BOUNDARY] caught error:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
    });
    try {
      fetch('http://127.0.0.1:7766/ingest/0c49ec12-84fe-49c1-b002-28f07f1904a9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ca3c2f' },
        body: JSON.stringify({
          sessionId: 'ca3c2f',
          location: 'App.tsx:ErrorBoundary',
          message: 'caught error',
          data: { message: error?.message, name: error?.name, stack: error?.stack, componentStack: errorInfo?.componentStack },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    } catch {}
    // #endregion
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ maxWidth: 600, textAlign: "left", color: "#fff" }}>
            <h2 style={{ fontSize: 18, marginBottom: 8, textAlign: "center" }}>Algo deu errado</h2>
            <p style={{ fontSize: 12, color: "#fbbf24", marginBottom: 8, textAlign: "center", fontWeight: 600 }}>{this.state.error}</p>
            {/* #region agent log */}
            <pre style={{ fontSize: 10, color: "#999", marginBottom: 16, maxHeight: 200, overflow: "auto", background: "#000", padding: 8, borderRadius: 4, whiteSpace: "pre-wrap" }}>
              {this.state.stack}
            </pre>
            {/* #endregion */}
            <div style={{ textAlign: "center" }}>
              <button onClick={() => window.location.reload()} style={{ padding: "8px 24px", borderRadius: 6, background: "#c5a236", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>
                Recarregar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/approve/:token" element={<ClientApprovalPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/*" element={<AuthenticatedApp />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
