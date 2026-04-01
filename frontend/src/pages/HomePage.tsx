import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { EditorPanel } from "../components/EditorPanel";
import { MetadataCard } from "../components/MetadataCard";
import { StatusBanner } from "../components/StatusBanner";
import type { ApiClient } from "../services/api";
import { ApiError, type CreateDocumentResponse } from "../types/api";

interface HomePageProps {
  apiClient: ApiClient;
  userId: string;
}

function mapHomeError(error: ApiError): string {
  if (error.status === 400 || error.status === 413) {
    return error.message;
  }

  if (error.code === "NETWORK_ERROR") {
    return "The backend is unavailable. Start the backend service and try again.";
  }

  return "The request could not be completed. Please try again.";
}

/**
 * The landing page combines the two required PoC flows: create a fresh
 * document or open an existing one by ID.
 */
export function HomePage({ apiClient, userId }: HomePageProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [documentIdToOpen, setDocumentIdToOpen] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [lastCreatedDocument, setLastCreatedDocument] = useState<CreateDocumentResponse | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage("Creating document...");

    try {
      const createdDocument = await apiClient.createDocument(
        {
          title,
          content,
        },
        userId
      );

      setLastCreatedDocument(createdDocument);
      setStatusMessage("Document created. Redirecting to document view...");
      console.info("[frontend-home] document_created", { documentId: createdDocument.documentId });
      navigate(`/documents/${createdDocument.documentId}`);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(0, "UNKNOWN_ERROR", "unknown error");
      setErrorMessage(mapHomeError(apiError));
      setStatusMessage(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage("Opening document...");
    setIsOpening(true);

    const trimmedId = documentIdToOpen.trim();
    navigate(`/documents/${encodeURIComponent(trimmedId)}`);

  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel-header">
          <h2>Create Document</h2>
          <p>Submit a title and plain-text content to the current backend PoC.</p>
        </div>
        <form className="stack" onSubmit={handleCreateSubmit}>
          <label className="field">
            <span className="field-label">Title</span>
            <input
              className="text-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Quarterly review notes"
              aria-label="Title"
            />
          </label>
          <EditorPanel
            label="Initial Content"
            value={content}
            onChange={setContent}
            hint="This content stays plain text so it matches the current backend contract."
          />
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Document"}
          </button>
        </form>
      </section>

      <section className="stack">
        <section className="panel">
          <div className="panel-header">
            <h2>Open Existing Document</h2>
            <p>Paste a document ID returned by the backend and open the document page.</p>
          </div>
          <form className="stack" onSubmit={handleOpenSubmit}>
            <label className="field">
              <span className="field-label">Document ID</span>
              <input
                className="text-input"
                value={documentIdToOpen}
                onChange={(event) => setDocumentIdToOpen(event.target.value)}
                placeholder="doc_123"
                aria-label="Document ID"
              />
            </label>
            <button className="secondary-button" type="submit" disabled={isOpening || !documentIdToOpen.trim()}>
              {isOpening ? "Opening..." : "Open Document"}
            </button>
          </form>
        </section>

        {statusMessage ? <StatusBanner tone="info" title="Request Status" message={statusMessage} /> : null}
        {errorMessage ? <StatusBanner tone="error" title="Request Failed" message={errorMessage} /> : null}
        {lastCreatedDocument ? <MetadataCard document={lastCreatedDocument} /> : null}
      </section>
    </div>
  );
}
