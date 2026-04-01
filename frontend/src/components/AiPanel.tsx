import { useState } from "react";
import type { AiAction, AiJobResponse } from "../types/api";
import type { AiSelectionSnapshot, AiService } from "../services/ai";
import { ApiError } from "../types/api";

interface AiPanelProps {
  documentId: string;
  snapshot: AiSelectionSnapshot;
  selectedText: string;
  aiService: AiService;
  onApply(text: string): void;
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

export function AiPanel({ documentId, snapshot, selectedText, aiService, onApply, onClose }: AiPanelProps) {
  const [action, setAction] = useState<AiAction>("rewrite");
  const [targetLanguage, setTargetLanguage] = useState("Chinese");
  const [phase, setPhase] = useState<"idle" | "loading" | "result" | "error">("idle");
  const [result, setResult] = useState<AiJobResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleRun() {
    if (!selectedText.trim()) return;

    setPhase("loading");
    setErrorMessage(null);
    setResult(null);

    try {
      let job: AiJobResponse;

      if (action === "rewrite") {
        job = await aiService.requestRewrite(documentId, snapshot);
      } else if (action === "summarize") {
        job = await aiService.requestSummarize(documentId, snapshot);
      } else {
        job = await aiService.requestTranslate(documentId, snapshot, targetLanguage);
      }

      if (job.status === "SUCCEEDED") {
        setResult(job);
        setPhase("result");
        return;
      }

      const polled = await aiService.pollJobUntilDone(job.jobId);
      setResult(polled);
      setPhase(polled.status === "SUCCEEDED" ? "result" : "error");

      if (polled.status === "FAILED") {
        setErrorMessage(polled.errorMessage || "AI job failed.");
      }
    } catch (error) {
      setErrorMessage(mapAiError(error));
      setPhase("error");
    }
  }

  function handleApply() {
    if (result?.output || result?.proposedText) {
      onApply(result.output || result.proposedText || "");
      onClose();
    }
  }

  const canRun = selectedText.trim().length > 0 && phase !== "loading";

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
                  onClick={() => { setAction(a.value); setPhase("idle"); setResult(null); }}
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

          {/* Loading state */}
          {phase === "loading" && (
            <div className="ai-spinner">
              <div className="spinner-ring" />
              <span>Running AI job…</span>
            </div>
          )}

          {/* Result */}
          {phase === "result" && (result?.output || result?.proposedText) && (
            <div className="field">
              <p className="field-label">AI suggestion</p>
              <div className="ai-result-box">{result.output || result.proposedText}</div>
              <p className="field-hint">Review the suggestion before applying. This will replace your selected text.</p>
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
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleApply}>
                Apply suggestion
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => { setPhase("idle"); setResult(null); }}
              >
                Discard
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
