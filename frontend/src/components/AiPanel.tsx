import { useEffect, useRef, useState } from "react";
import type { AiAction, AiJobResponse } from "../types/api";
import type { AiJobStatus, AiSelectionSnapshot, AiService } from "../services/ai";
import { ApiError } from "../types/api";

export interface AiApplyPayload {
  text: string;
  mode: "full" | "partial";
  jobId: string | null;
  targetSelection: AiSelectionSnapshot["selection"];
}

interface AiPanelProps {
  documentId: string;
  snapshot: AiSelectionSnapshot;
  selectedText: string;
  aiService: AiService;
  onApply(payload: AiApplyPayload): Promise<void> | void;
  onReject(jobId: string | null): Promise<void> | void;
  onClose(): void;
}

const ACTIONS: { value: AiAction; label: string; emoji: string }[] = [
  { value: "rewrite", label: "Rewrite", emoji: "✏️" },
  { value: "summarize", label: "Summarize", emoji: "📝" },
  { value: "translate", label: "Translate", emoji: "🌐" },
];

const LANGUAGES = ["English", "Chinese", "Spanish", "French", "German", "Arabic", "Japanese"];

function mapAiError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "NETWORK_ERROR") return "Backend unavailable. Start the backend and try again.";
    if (error.status === 403) return "AI features are disabled or your quota has been exceeded.";
    if (error.status === 429) return "Quota exceeded. Please try again later.";
    if (error.status === 404) return "AI service is not yet available on this backend.";
    return error.message || "AI request failed.";
  }
  return "Unexpected error. Please try again.";
}

function formatJobStatus(status: AiJobStatus | null): string {
  if (status === "PENDING") return "Queued for processing";
  if (status === "RUNNING") return "Generating suggestion";
  if (status === "SUCCEEDED") return "Suggestion ready";
  if (status === "FAILED") return "Generation failed";
  return "Ready to run";
}

export function AiPanel({ documentId, snapshot, selectedText, aiService, onApply, onReject, onClose }: AiPanelProps) {
  const [action, setAction] = useState<AiAction>("rewrite");
  const [targetLanguage, setTargetLanguage] = useState("Chinese");
  const [phase, setPhase] = useState<"idle" | "loading" | "result" | "error">("idle");
  const [result, setResult] = useState<AiJobResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<AiJobStatus | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [editableSuggestion, setEditableSuggestion] = useState("");
  const [suggestionSelection, setSuggestionSelection] = useState<{ start: number; end: number } | null>(null);
  const suggestionRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const nextSuggestion = result?.output || result?.proposedText || "";
    setEditableSuggestion(nextSuggestion);
    setSuggestionSelection(null);
  }, [result]);

  async function handleRun() {
    if (!selectedText.trim()) return;

    setPhase("loading");
    setErrorMessage(null);
    setResult(null);
    setJobStatus(null);
    setJobId(null);

    try {
      let job: AiJobResponse;

      if (action === "rewrite") {
        job = await aiService.requestRewrite(documentId, snapshot);
      } else if (action === "summarize") {
        job = await aiService.requestSummarize(documentId, snapshot);
      } else {
        job = await aiService.requestTranslate(documentId, snapshot, targetLanguage);
      }

      setJobId(job.jobId);
      setJobStatus(job.status);

      if (job.status === "SUCCEEDED") {
        setResult(job);
        setJobStatus("SUCCEEDED");
        setPhase("result");
        return;
      }

      const polled = await aiService.pollJobUntilDone(job.jobId, {
        onStatusChange(nextJob) {
          setJobStatus(nextJob.status);
        },
      });
      setResult(polled);
      setJobStatus(polled.status);
      setPhase(polled.status === "SUCCEEDED" ? "result" : "error");

      if (polled.status === "FAILED") {
        setErrorMessage(polled.errorMessage || "AI job failed.");
      }
    } catch (error) {
      setJobStatus("FAILED");
      setErrorMessage(mapAiError(error));
      setPhase("error");
    }
  }

  async function handleApply(mode: "full" | "partial") {
    const nextText =
      mode === "partial" && suggestionSelection && suggestionSelection.end > suggestionSelection.start
        ? editableSuggestion.slice(suggestionSelection.start, suggestionSelection.end)
        : editableSuggestion;

    if (!nextText.trim()) {
      setErrorMessage("AI suggestion is empty. Generate or edit a suggestion before applying it.");
      setPhase("error");
      return;
    }

    await onApply({
      text: nextText,
      mode,
      jobId,
      targetSelection: snapshot.selection,
    });
    onClose();
  }

  async function handleReject() {
    await onReject(jobId);
    onClose();
  }

  const canRun = selectedText.trim().length > 0 && phase !== "loading";
  const hasPartialSelection = Boolean(
    suggestionSelection && suggestionSelection.end > suggestionSelection.start && editableSuggestion.length > 0
  );

  return (
    <>
      <div className="side-panel-overlay" onClick={onClose} />
      <aside className="side-panel">
        <div className="side-panel-header">
          <h3>
            <span>✨</span>
            AI Assistant
          </h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="side-panel-body">
          {/* Action tabs */}
          <div>
            <p className="field-label" style={{ marginBottom: "0.5rem" }}>Action</p>
            <div className="ai-action-tabs">
              {ACTIONS.map((a) => (
                <button
                  key={a.value}
                  className={`ai-tab${action === a.value ? " active" : ""}`}
                  onClick={() => {
                    setAction(a.value);
                    setPhase("idle");
                    setResult(null);
                    setEditableSuggestion("");
                    setSuggestionSelection(null);
                  }}
                >
                  {a.emoji} {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Target language (translate only) */}
          {action === "translate" && (
            <div className="field">
              <label className="field-label" htmlFor="target-lang">Target language</label>
              <select
                id="target-lang"
                className="text-input"
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          )}

          {/* Selection preview */}
          <div className="field">
            <p className="field-label">Selected text</p>
            {selectedText.trim() ? (
              <div className="ai-selection-preview">{selectedText}</div>
            ) : (
              <p className="field-hint" style={{ fontStyle: "italic" }}>
                No text selected. Select text in the editor before using AI.
              </p>
            )}
          </div>

          <div className="field ai-job-status-card">
            <p className="field-label">Job status</p>
            <div className="ai-job-status-row">
              <strong>{formatJobStatus(jobStatus)}</strong>
              {jobId && <span className="field-hint">{jobId}</span>}
            </div>
            {phase === "loading" && (
              <p className="field-hint">
                The backend is running an async job and polling for the final suggestion.
              </p>
            )}
          </div>

          {/* Loading state */}
          {phase === "loading" && (
            <div className="ai-spinner">
              <div className="spinner-ring" />
              <span>{formatJobStatus(jobStatus)}</span>
            </div>
          )}

          {/* Result */}
          {phase === "result" && editableSuggestion && (
            <div className="field ai-review-grid">
              <div>
                <p className="field-label">Before</p>
                <div className="ai-selection-preview">{selectedText}</div>
              </div>
              <div>
                <p className="field-label">After</p>
                <textarea
                  ref={suggestionRef}
                  className="ai-result-box ai-result-editor"
                  value={editableSuggestion}
                  onChange={(event) => setEditableSuggestion(event.target.value)}
                  onSelect={() => {
                    const element = suggestionRef.current;
                    if (!element) {
                      return;
                    }

                    setSuggestionSelection({
                      start: element.selectionStart,
                      end: element.selectionEnd,
                    });
                  }}
                />
              </div>
              <p className="field-hint">
                Review or edit the suggestion before applying. "Apply selection" uses only the highlighted portion of the AI output.
              </p>
            </div>
          )}

          {/* Error */}
          {phase === "error" && errorMessage && (
            <div className="status-banner status-error" role="alert">
              <strong>AI request failed</strong>
              <p>{errorMessage}</p>
            </div>
          )}
        </div>

        <div className="side-panel-footer">
          {phase === "result" ? (
            <>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => void handleApply("full")}>
                Apply all
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => void handleApply("partial")}
                disabled={!hasPartialSelection}
              >
                Apply selection
              </button>
              <button className="btn btn-secondary" onClick={() => void handleReject()}>
                Reject
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-ai"
                style={{ flex: 1 }}
                onClick={handleRun}
                disabled={!canRun}
              >
                {phase === "loading" ? "Running…" : "Run AI"}
              </button>
              <button className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
