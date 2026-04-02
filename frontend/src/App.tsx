import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

import { AppBar } from "./components/AppBar";
import { createApiClient } from "./services/api";
import { DocumentPage } from "./pages/DocumentPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";

const DEFAULT_USER_ID = "";
const USER_ID_STORAGE_KEY = "collaborative-editor-ai.user-id";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3000";
const apiClient = createApiClient(API_BASE_URL);

function readSessionUserId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(USER_ID_STORAGE_KEY)?.trim() || null;
}

function readStoredUserId(): string {
  if (typeof window === "undefined") {
    return DEFAULT_USER_ID;
  }

  const sessionUserId = readSessionUserId();
  if (sessionUserId) {
    return sessionUserId;
  }

  return window.localStorage.getItem(USER_ID_STORAGE_KEY)?.trim() || DEFAULT_USER_ID;
}

/**
 * Document pages use their own full-screen layout (Google Docs style).
 * The home shell wraps home routes with the AppBar.
 */
function AppRoutes({
  userId,
  onUserIdChange,
  onSignOut,
}: {
  userId: string;
  onUserIdChange(v: string): void;
  onSignOut(): void;
}) {
  const location = useLocation();
  const isDocPage = location.pathname.startsWith("/documents/");

  if (!userId.trim()) {
    return <LoginPage apiClient={apiClient} onAuthenticated={onUserIdChange} />;
  }

  if (isDocPage) {
    return (
      <Routes>
        <Route
          path="/documents/:documentId"
          element={
            <DocumentPage
              apiClient={apiClient}
              userId={userId}
              onUserIdChange={onUserIdChange}
              onSignOut={onSignOut}
            />
          }
        />
      </Routes>
    );
  }

  return (
    <div className="home-shell">
      <AppBar userId={userId} onUserIdChange={onUserIdChange} onSignOut={onSignOut} />
      <Routes>
        <Route path="/" element={<HomePage apiClient={apiClient} userId={userId} />} />
      </Routes>
    </div>
  );
}

export function App() {
  const [userId, setUserId] = useState(readStoredUserId);

  useEffect(() => {
    if (userId.trim()) {
      window.sessionStorage.setItem(USER_ID_STORAGE_KEY, userId);
    } else {
      window.sessionStorage.removeItem(USER_ID_STORAGE_KEY);
    }
    window.localStorage.removeItem(USER_ID_STORAGE_KEY);
  }, [userId]);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes userId={userId} onUserIdChange={setUserId} onSignOut={() => setUserId("")} />
    </BrowserRouter>
  );
}
