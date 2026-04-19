import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { StatusBanner } from "../components/StatusBanner";
import type { ApiClient } from "../services/api";
import type { DashboardData, DashboardDocumentSummary, DashboardService } from "../services/dashboard";
import { ApiError } from "../types/api";

interface HomePageProps {
  apiClient: ApiClient;
  dashboardService: DashboardService;
  userId: string;
  displayName: string;
  searchQuery: string;
}

function mapError(error: ApiError): string {
  if (error.status === 400 || error.status === 413) return error.message;
  if (error.code === "NETWORK_ERROR") return "Backend unavailable. Start the backend service and try again.";
  return "Request failed. Please try again.";
}

const TEMPLATES = [
  { name: "Blank", icon: null },
  { name: "Resume", icon: "📄" },
  { name: "Letter", icon: "✉️" },
  { name: "Project brief", icon: "📋" },
  { name: "Meeting notes", icon: "📝" },
];

function formatUpdatedAt(updatedAt: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(updatedAt));
}

function DocumentListSection({
  title,
  documents,
  emptyMessage,
  onOpen,
}: {
  title: string;
  documents: DashboardDocumentSummary[];
  emptyMessage: string;
  onOpen(documentId: string): void;
}) {
  return (
    <section className="dashboard-section">
      <div className="dashboard-section-header">
        <h3>{title}</h3>
        <span>{documents.length}</span>
      </div>

      {documents.length === 0 ? (
        <div className="dashboard-empty-card">
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="dashboard-grid">
          {documents.map((document) => (
            <button
              key={document.documentId}
              type="button"
              className="dashboard-card"
              onClick={() => onOpen(document.documentId)}
            >
              <div className="dashboard-card-top">
                <strong>{document.title}</strong>
                <span className={`role-pill role-pill-${document.role}`}>{document.role}</span>
              </div>
              <p className="dashboard-card-id">{document.documentId}</p>
              <div className="dashboard-card-meta">
                <span>Updated {formatUpdatedAt(document.updatedAt)}</span>
                {document.ownerDisplayName && <span>Owner {document.ownerDisplayName}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function matchesDocument(document: DashboardDocumentSummary, searchQuery: string): boolean {
  const normalized = searchQuery.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [document.title, document.documentId, document.ownerDisplayName || "", document.role]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

function sortDocuments(
  documents: DashboardDocumentSummary[],
  sortMode: "recent" | "title" | "role"
): DashboardDocumentSummary[] {
  const nextDocuments = [...documents];
  if (sortMode === "title") {
    nextDocuments.sort((left, right) => left.title.localeCompare(right.title));
    return nextDocuments;
  }
  if (sortMode === "role") {
    nextDocuments.sort((left, right) => left.role.localeCompare(right.role) || left.title.localeCompare(right.title));
    return nextDocuments;
  }
  nextDocuments.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  return nextDocuments;
}

export function HomePage({ apiClient, dashboardService, userId, displayName, searchQuery }: HomePageProps) {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [openId, setOpenId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData>({ owned: [], shared: [] });
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"recent" | "title" | "role">("recent");

  async function loadDashboard() {
    setIsLoadingDashboard(true);
    setDashboardError(null);

    try {
      const nextDashboardData = await dashboardService.listDocuments(userId);
      setDashboardData(nextDashboardData);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(0, "UNKNOWN_ERROR", "unknown error");
      setDashboardError(mapError(apiError));
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [dashboardService, userId]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const created = await apiClient.createDocument({ title: title || "Untitled document", content }, userId);
      await dashboardService.rememberCreatedDocument(userId, created);
      await loadDashboard();
      navigate(`/documents/${created.documentId}`);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(0, "UNKNOWN_ERROR", "unknown error");
      setErrorMessage(mapError(apiError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenSubmit(event: FormEvent) {
    event.preventDefault();
    if (openId.trim()) navigate(`/documents/${encodeURIComponent(openId.trim())}`);
  }

  function handleTemplateClick(templateName: string) {
    setTitle(templateName === "Blank" ? "" : templateName);
    setContent("");
    setShowCreateModal(true);
  }

  function openDocument(documentId: string) {
    navigate(`/documents/${encodeURIComponent(documentId)}`);
  }

  const filteredOwned = sortDocuments(
    dashboardData.owned.filter((document) => matchesDocument(document, searchQuery)),
    sortMode
  );
  const filteredShared = sortDocuments(
    dashboardData.shared.filter((document) => matchesDocument(document, searchQuery)),
    sortMode
  );

  const hasActiveSearch = searchQuery.trim().length > 0;

  return (
    <div style={{ flex: 1, background: "var(--gd-surface)" }}>
      <div className="templates-strip">
        <div className="templates-strip-inner">
          <div className="templates-header">
            <div className="dashboard-title-block">
              <h2>Welcome back, {displayName || userId}</h2>
              <p>Open your recent work or start a new document from a clean dashboard flow.</p>
            </div>
              <a data-testid="new-document-trigger" onClick={() => setShowCreateModal(true)}>New document</a>
          </div>
          <div className="templates-grid">
            {TEMPLATES.map((template) => (
              <div
                key={template.name}
                className="template-card"
                onClick={() => handleTemplateClick(template.name)}
                role="button"
                tabIndex={0}
              >
                <div className="template-preview">
                  {template.icon ? (
                    <span style={{ fontSize: 32 }}>{template.icon}</span>
                  ) : (
                    <div className="template-blank-preview" />
                  )}
                </div>
                <div className="template-name">{template.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="recent-section">
        <div className="recent-header">
          <h2>Dashboard</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <label htmlFor="dashboard-sort" className="field-hint" style={{ margin: 0 }}>
              Sort by
            </label>
            <select
              id="dashboard-sort"
              className="text-input"
              style={{ width: 160 }}
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as "recent" | "title" | "role")}
              aria-label="Sort documents"
            >
              <option value="recent">Recently updated</option>
              <option value="title">Title</option>
              <option value="role">Role</option>
            </select>
          </div>
        </div>

        <form className="open-doc-form" onSubmit={handleOpenSubmit}>
          <input
            className="open-doc-input"
            value={openId}
            onChange={(event) => setOpenId(event.target.value)}
            placeholder="Paste a document ID to open..."
            aria-label="Document ID"
            spellCheck={false}
          />
          <button className="btn btn-secondary btn-sm" type="submit" disabled={!openId.trim()}>
            Open
          </button>
        </form>

        {dashboardError && (
          <div style={{ marginBottom: "1rem" }}>
            <StatusBanner tone="error" title="Dashboard unavailable" message={dashboardError} />
          </div>
        )}

        {isLoadingDashboard ? (
          <StatusBanner tone="info" title="Loading dashboard" message="Gathering your owned and shared documents." />
        ) : (
          <div className="dashboard-stack">
            {hasActiveSearch && filteredOwned.length === 0 && filteredShared.length === 0 && (
              <StatusBanner
                tone="info"
                title="No matches"
                message={`No documents matched "${searchQuery.trim()}". Try a different title, role, or document ID.`}
              />
            )}
            <DocumentListSection
              title="Owned by you"
              documents={filteredOwned}
              emptyMessage={hasActiveSearch ? "No owned documents match the current search." : "You have not created any documents yet."}
              onOpen={openDocument}
            />
            <DocumentListSection
              title="Shared with you"
              documents={filteredShared}
              emptyMessage={hasActiveSearch ? "No shared documents match the current search." : "Documents shared with you will appear here."}
              onOpen={openDocument}
            />
          </div>
        )}
      </div>

      {showCreateModal && (
        <>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 300 }}
            onClick={() => setShowCreateModal(false)}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              width: "min(480px, calc(100vw - 2rem))",
              background: "var(--gd-surface)",
              borderRadius: 8,
              padding: "1.5rem",
              boxShadow: "0 8px 32px rgba(0,0,0,.2)",
              zIndex: 301,
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: 18, fontWeight: 400 }}>New document</h2>
              <button className="gd-icon-btn" onClick={() => setShowCreateModal(false)} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="field">
                <label className="field-label" htmlFor="new-title">Title</label>
                <input
                  id="new-title"
                  data-testid="new-document-title"
                  className="text-input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Untitled document"
                  autoFocus
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="new-content">
                  Initial content <span style={{ textTransform: "none", fontWeight: 400, color: "var(--gd-text-3)" }}>(optional)</span>
                </label>
                <textarea
                  id="new-content"
                  data-testid="new-document-content"
                  className="text-input"
                  style={{ minHeight: 100, resize: "vertical" }}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Start writing..."
                />
              </div>

              {errorMessage && <StatusBanner tone="error" title="Create failed" message={errorMessage} />}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" data-testid="new-document-submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
