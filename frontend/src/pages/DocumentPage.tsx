import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EditorPanel } from "../components/EditorPanel";
import { MetadataCard } from "../components/MetadataCard";
import { StatusBanner } from "../components/StatusBanner";
import type { ApiClient } from "../services/api";
import { ApiError, type GetDocumentResponse } from "../types/api";

interface DocumentPageProps {
  apiClient: ApiClient;
  userId: string;
}

function mapDocumentError(error: ApiError): string {
  if (error.status === 404) {
    return "Document not found.";
  }

  if (error.code === "NETWORK_ERROR") {
    return "The backend is unavailable. Start the backend service and refresh this page.";
  }

  return error.message || "The document could not be loaded.";
}

/**
 * This page deliberately separates persisted backend state from local draft
 * state so future save APIs can be added without redesigning the UI.
 */
export function DocumentPage({ apiClient, userId }: DocumentPageProps) {
  const { documentId = "" } = useParams();
  const [document, setDocument] = useState<GetDocumentResponse | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDocument() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const fetchedDocument = await apiClient.getDocument(documentId, userId);
        if (cancelled) {
          return;
        }

        console.info("[frontend-document] document_loaded", {
          documentId: fetchedDocument.documentId,
          role: fetchedDocument.role,
        });
        setDocument(fetchedDocument);
        setDraftContent(fetchedDocument.content);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const apiError = error instanceof ApiError ? error : new ApiError(0, "UNKNOWN_ERROR", "unknown error");
        setErrorMessage(mapDocumentError(apiError));
        setDocument(null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDocument();

    return () => {
      cancelled = true;
    };
  }, [apiClient, documentId, userId]);

  const isReadOnly = document?.role === "viewer";
  const hasLocalDraft = document !== null && draftContent !== document.content;

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Document View</p>
          <h2>{document?.title || documentId}</h2>
        </div>
        <Link className="secondary-link" to="/">
          Back to Home
        </Link>
      </div>

      {isLoading ? (
        <StatusBanner tone="info" title="Loading" message="Fetching document from the backend..." />
      ) : null}
      {errorMessage ? <StatusBanner tone="error" title="Load Failed" message={errorMessage} /> : null}

      {document ? (
        <>
          <MetadataCard document={document} />

          {isReadOnly ? (
            <StatusBanner
              tone="warning"
              title="View-only mode"
              message="This role can review content but cannot edit the local draft."
            />
          ) : hasLocalDraft ? (
            <StatusBanner
              tone="success"
              title="Unsaved local draft"
              message="Your edits are local only. The backend PoC does not expose a save API yet."
            />
          ) : (
            <StatusBanner
              tone="info"
              title="Request Status"
              message="This page is synced with the latest backend response. Editing here changes only your local draft."
            />
          )}

          <EditorPanel
            label="Document Content"
            value={draftContent}
            onChange={setDraftContent}
            readOnly={isReadOnly}
            hint={
              isReadOnly
                ? "Viewer mode mirrors backend content exactly."
                : "Owner/editor mode allows local drafting while the backend save API is still pending."
            }
          />
        </>
      ) : null}
    </div>
  );
}
