import type { ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AppBar } from "./components/AppBar";
import { DocumentPage } from "./pages/DocumentPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { createApiClient } from "./services/api";
import { createMockFirstAuthAdapter } from "./services/authAdapter";
import { createDashboardService } from "./services/dashboard";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3000";
const apiClient = createApiClient(API_BASE_URL);
const authAdapter = createMockFirstAuthAdapter(apiClient);
const dashboardService = createDashboardService();

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { session, authStatus } = useAuth();

  if (authStatus === "restoring" || authStatus === "refreshing") {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="login-brand">Collaborative Editor AI</div>
          <h1>Restoring session</h1>
          <p>Checking your saved session before opening the workspace.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRoutes() {
  const { session, logout } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={session ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={session ? <Navigate to="/" replace /> : <RegisterPage />}
      />
      <Route
        path="/documents/:documentId"
        element={(
          <ProtectedRoute>
            <DocumentPage
              apiClient={apiClient}
              dashboardService={dashboardService}
              userId={session?.user.id || ""}
              displayName={session?.user.displayName || ""}
              onSignOut={logout}
            />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/"
        element={(
          <ProtectedRoute>
            <div className="home-shell">
              <AppBar
                userId={session?.user.id || ""}
                displayName={session?.user.displayName || ""}
                onSignOut={logout}
              />
              <HomePage
                apiClient={apiClient}
                dashboardService={dashboardService}
                userId={session?.user.id || ""}
                displayName={session?.user.displayName || ""}
              />
            </div>
          </ProtectedRoute>
        )}
      />
      <Route path="*" element={<Navigate to={session ? "/" : "/login"} replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider adapter={authAdapter}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
