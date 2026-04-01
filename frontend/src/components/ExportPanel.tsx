import { useState } from "react";
import type { ApiClient } from "../services/api";
import {
  ApiError,
  type CreateExportResponse,
  type ExportFormat,
  type ExportJobStatusResponse,
} from "../types/api";

interface ExportPanelProps {
  documentId: string;
  userId: string;
  apiClient: ApiClient;
  onClose(): void;
}

const EXPORT_FORMATS: ExportFormat[] = ["txt", "json", "pdf", "docx"];

function isQueuedExport(response: CreateExportResponse): response is { jobId: string; statusUrl: string } {
  return "jobId" in response;
}

function mapExportError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "NETWORK_ERROR") return "Backend unavailable. Start the backend and try again.";
    return error.message || "Export request failed.";
  }

  return "Export request failed.";
}

function saveBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

function makeSyncBlob(content: string, contentType: string): Blob {
  return new Blob([content], { type: contentType });
}

/**
 * Export is intentionally isolated from the main editor so sync and async
 * formats can share one UI without complicating the document page.
 */
export function ExportPanel({ documentId, userId, apiClient, onClose }: ExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>("txt");
  const [phase, setPhase] = useState<"idle" | "requesting" | "polling" | "ready" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<ExportJobStatusResponse | null>(null);
  const [downloadReadyMessage, setDownloadReadyMessage] = useState<string | null>(null);

  async function pollExportJob(jobId: string) {
    setPhase("polling");

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const nextStatus = await apiClient.getExportJobStatus(jobId, userId);
      setJobStatus(nextStatus);

      if (nextStatus.status === "SUCCEEDED") {
        setPhase("ready");
        setDownloadReadyMessage("Export is ready to download.");
        return;
      }

      if (nextStatus.status === "FAILED") {
        setPhase("error");
        setErrorMessage(nextStatus.errorMessage || "Export job failed.");
        return;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 300));
    }

    setPhase("error");
    setErrorMessage("Export job did not finish in time.");
  }

  async function handleExportRequest() {
    setPhase("requesting");
    setErrorMessage(null);
    setJobStatus(null);
    setDownloadReadyMessage(null);

    try {
      const response = await apiClient.createExport(
        documentId,
        {
          format,
          requestId: `req_export_${Date.now()}_${format}`,
        },
        userId
      );

      if (isQueuedExport(response)) {
        await pollExportJob(response.jobId);
        return;
      }

      saveBlob(makeSyncBlob(response.content, response.contentType), response.fileName);
      setPhase("ready");
      setDownloadReadyMessage(`Downloaded ${response.fileName}.`);
    } catch (error) {
      setPhase("error");
      setErrorMessage(mapExportError(error));
    }
  }

  async function handleDownloadAsyncExport() {
    if (!jobStatus) {
      return;
    }

    try {
      const file = await apiClient.downloadExport(jobStatus.jobId, userId);
      saveBlob(file.blob, file.fileName);
      setDownloadReadyMessage(`Downloaded ${file.fileName}.`);
    } catch (error) {
      setErrorMessage(mapExportError(error));
      setPhase("error");
    }
  }

  return (
    <>
      <div className="side-panel-overlay" onClick={onClose} />
      <aside className="side-panel">
        <div className="side-panel-header">
          <h3>
            <span>📤</span>
            Export
          </h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="side-panel-body">
          <div className="field">
            <label className="field-label" htmlFor="export-format">
              File format
            </label>
            <select
              id="export-format"
              className="text-input"
              value={format}
              onChange={(event) => setFormat(event.target.value as ExportFormat)}
            >
              {EXPORT_FORMATS.map((option) => (
                <option key={option} value={option}>
                  {option.toUpperCase()}
                </option>
              ))}
            </select>
            <p className="field-hint">
              TXT and JSON download immediately. PDF and DOCX are generated as async jobs.
            </p>
          </div>

          {phase === "polling" && <p className="field-hint">Generating export…</p>}
          {downloadReadyMessage && (
            <div className="status-banner status-success">
              <strong>Export ready</strong>
              <p>{downloadReadyMessage}</p>
            </div>
          )}
          {errorMessage && (
            <div className="status-banner status-error" role="alert">
              <strong>Export failed</strong>
              <p>{errorMessage}</p>
            </div>
          )}

          {jobStatus && (
            <div className="panel">
              <div className="panel-header">
                <h2>Async export job</h2>
              </div>
              <div className="metadata-grid">
                <div>
                  <dt>Job ID</dt>
                  <dd>{jobStatus.jobId}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{jobStatus.status}</dd>
                </div>
                <div>
                  <dt>Download URL</dt>
                  <dd>{jobStatus.downloadUrl || "Pending"}</dd>
                </div>
                <div>
                  <dt>Expires At</dt>
                  <dd>{jobStatus.expiresAt || "Pending"}</dd>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="side-panel-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          {jobStatus?.status === "SUCCEEDED" ? (
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => void handleDownloadAsyncExport()}>
              Download export
            </button>
          ) : (
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => void handleExportRequest()}
              disabled={phase === "requesting" || phase === "polling"}
            >
              {phase === "requesting" || phase === "polling" ? "Preparing…" : "Start export"}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
