import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AppBar } from "./components/AppBar";
import { createApiClient } from "./services/api";
import { DocumentPage } from "./pages/DocumentPage";
import { HomePage } from "./pages/HomePage";

const DEFAULT_USER_ID = "user_1";
const USER_ID_STORAGE_KEY = "collaborative-editor-ai.user-id";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3000";
const apiClient = createApiClient(API_BASE_URL);

function readStoredUserId(): string {
  if (typeof window === "undefined") {
    return DEFAULT_USER_ID;
  }

  return window.localStorage.getItem(USER_ID_STORAGE_KEY)?.trim() || DEFAULT_USER_ID;
}

/**
 * The app keeps user selection in localStorage so reviewers can switch
 * identities and immediately observe owner/viewer UI behavior.
 */
export function App() {
  const [userId, setUserId] = useState(readStoredUserId);

  useEffect(() => {
    window.localStorage.setItem(USER_ID_STORAGE_KEY, userId);
  }, [userId]);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="app-shell">
        <AppBar apiBaseUrl={API_BASE_URL} userId={userId} onUserIdChange={setUserId} />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<HomePage apiClient={apiClient} userId={userId} />} />
            <Route
              path="/documents/:documentId"
              element={<DocumentPage apiClient={apiClient} userId={userId} />}
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
