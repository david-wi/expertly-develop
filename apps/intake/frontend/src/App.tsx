import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import Layout from './components/Layout';
import {
  LoginPage,
  IntakesListPage,
  CreateIntakePage,
  IntakeDashboardPage,
  SectionOverviewPage,
  QuestionDetailPage,
  PeoplePage,
  DocumentsPage,
  ProposalsPage,
  TimelinePage,
  IntakeUsagePage,
  TemplatesPage,
  TemplateEditorPage,
  VoicesPage,
  UsageReportPage,
  SettingsPage,
} from './pages';

// ---------------------------------------------------------------------------
// React Query client
// ---------------------------------------------------------------------------

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// App root
// ---------------------------------------------------------------------------

function AppRoutes() {
  const loadUser = useAuthStore((s: { loadUser: () => Promise<void> }) => s.loadUser);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected — wrapped in Layout */}
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/intakes" replace />} />

        {/* Intakes */}
        <Route path="intakes" element={<IntakesListPage />} />
        <Route path="intakes/new" element={<CreateIntakePage />} />
        <Route path="intakes/:intakeId" element={<IntakeDashboardPage />} />
        <Route path="intakes/:intakeId/sections/:sectionId" element={<SectionOverviewPage />} />
        <Route path="intakes/:intakeId/questions/:questionId" element={<QuestionDetailPage />} />
        <Route path="intakes/:intakeId/people" element={<PeoplePage />} />
        <Route path="intakes/:intakeId/documents" element={<DocumentsPage />} />
        <Route path="intakes/:intakeId/proposals" element={<ProposalsPage />} />
        <Route path="intakes/:intakeId/timeline" element={<TimelinePage />} />
        <Route path="intakes/:intakeId/usage" element={<IntakeUsagePage />} />

        {/* Admin */}
        <Route path="admin/templates" element={<TemplatesPage />} />
        <Route path="admin/templates/:templateId" element={<TemplateEditorPage />} />
        <Route path="admin/voices" element={<VoicesPage />} />
        <Route path="admin/usage" element={<UsageReportPage />} />

        {/* Settings */}
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/intakes" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
