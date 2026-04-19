import { useState, type ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AppBar } from "./components/AppBar";
import { DocumentPage } from "./pages/DocumentPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ShareLinkPage } from "./pages/ShareLinkPage";
import { createApiClient } from "./services/api";
import { createBackendAuthAdapter } from "./services/authAdapter";
import { createDashboardService } from "./services/dashboard";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:8000";
const apiClient = createApiClient(API_BASE_URL);
const authAdapter = createBackendAuthAdapter(apiClient);
const dashboardService = createDashboardService(apiClient);

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

function AuthEntryRoute({ children }: { children: ReactElement }) {
  const { session } = useAuth();
  const location = useLocation();
  const nextPath = new URLSearchParams(location.search).get("next") || "/";

  if (session) {
    return <Navigate to={nextPath} replace />;
  }

  return children;
}

function AppRoutes() {
  const { session, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <Routes>
      <Route
        path="/login"
        element={<AuthEntryRoute><LoginPage /></AuthEntryRoute>}
      />
      <Route
        path="/register"
        element={<AuthEntryRoute><RegisterPage /></AuthEntryRoute>}
      />
      <Route
        path="/forgot-password"
        element={<ForgotPasswordPage apiClient={apiClient} />}
      />
      <Route
        path="/share/:shareToken"
        element={<ShareLinkPage apiClient={apiClient} />}
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
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                onSignOut={logout}
              />
              <HomePage
                apiClient={apiClient}
                dashboardService={dashboardService}
                userId={session?.user.id || ""}
                displayName={session?.user.displayName || ""}
                searchQuery={searchQuery}
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
