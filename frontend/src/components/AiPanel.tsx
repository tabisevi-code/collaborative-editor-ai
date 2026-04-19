import { useEffect, useRef, useState } from "react";

import type { AiAction, AiUsageResponse } from "../types/api";
import type { AiHistoryItem, AiSelectionSnapshot, AiService } from "../services/ai";
import { ApiError } from "../types/api";

export interface AiApplyPayload {
  text: string;
  mode: "full" | "partial";
  jobId: string | null;
  targetSelection: AiSelectionSnapshot["selection"];
  sourceText: string;
  edited: boolean;
}

interface AiPanelProps {
  documentId: string;
  snapshot: AiSelectionSnapshot;
  selectedText: string;
  aiService: AiService;
  onUseWholeDocument?(): void;
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

type AiPanelPhase = "idle" | "streaming" | "completed" | "cancelled" | "error";

function formatJobStatus(phase: AiPanelPhase): string {
  if (phase === "streaming") return "Streaming suggestion";
  if (phase === "completed") return "Suggestion ready";
  if (phase === "cancelled") return "Generation cancelled";
  if (phase === "error") return "Generation failed";
  return "Ready to run";
}

export function AiPanel({ documentId, snapshot, selectedText, aiService, onUseWholeDocument, onApply, onReject, onClose }: AiPanelProps) {
  const [action, setAction] = useState<AiAction>("rewrite");
  const [targetLanguage, setTargetLanguage] = useState("Chinese");
  const [instruction, setInstruction] = useState("Make this clearer and more concise.");
  const [phase, setPhase] = useState<AiPanelPhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [editableSuggestion, setEditableSuggestion] = useState("");
  const [generatedSuggestion, setGeneratedSuggestion] = useState("");
  const [suggestionSelection, setSuggestionSelection] = useState<{ start: number; end: number } | null>(null);
  const [historyItems, setHistoryItems] = useState<AiHistoryItem[]>([]);
  const [usage, setUsage] = useState<AiUsageResponse | null>(null);
  const [runSnapshot, setRunSnapshot] = useState<AiSelectionSnapshot | null>(null);
  const suggestionRef = useRef<HTMLTextAreaElement | null>(null);
  const activeSessionRef = useRef<{ cancel(): void } | null>(null);

  async function loadHistory() {
    const items = await aiService.listHistory(documentId);
    setHistoryItems(items);
  }

  async function loadUsage() {
    const nextUsage = await aiService.getUsage(documentId);
    setUsage(nextUsage);
  }

  useEffect(() => {
    void Promise.all([loadHistory(), loadUsage()]);
  }, [aiService, documentId]);

  useEffect(() => {
    return () => {
      activeSessionRef.current?.cancel();
    };
  }, []);

  async function handleRun() {
    if (!selectedText.trim()) return;

    activeSessionRef.current?.cancel();
    setPhase("streaming");
    setErrorMessage(null);
    setJobId(null);
    setEditableSuggestion("");
    setGeneratedSuggestion("");
    setSuggestionSelection(null);
    setRunSnapshot(snapshot);

    try {
      const session = await aiService.startStream({
        documentId,
        ...snapshot,
        action,
        targetLanguage,
        instruction,
      });
      activeSessionRef.current = session;
      setJobId(session.jobId);

      let finalText = "";
      for await (const chunk of session.stream) {
        if (chunk.jobId && !jobId) {
          setJobId(chunk.jobId);
        }

        if (chunk.type === "token") {
          finalText += chunk.text || "";
          setEditableSuggestion(finalText);
          continue;
        }

        if (chunk.type === "error") {
          setErrorMessage(chunk.errorMessage || "AI generation failed.");
          setPhase("error");
          await Promise.all([loadHistory(), loadUsage()]);
          return;
        }

        if (chunk.type === "done") {
          const completedText = chunk.text || finalText;
          setGeneratedSuggestion(completedText);
          setEditableSuggestion(completedText);
          setPhase("completed");
          await Promise.all([loadHistory(), loadUsage()]);
          return;
        }
      }

      setPhase("cancelled");
      await Promise.all([loadHistory(), loadUsage()]);
    } catch (error) {
      setErrorMessage(mapAiError(error));
      setPhase("error");
    }
  }

  async function handleApply(mode: "full" | "partial") {
    const applySnapshot = runSnapshot ?? snapshot;
    const nextText =
      mode === "partial" && suggestionSelection && suggestionSelection.end > suggestionSelection.start
        ? editableSuggestion.slice(suggestionSelection.start, suggestionSelection.end)
        : editableSuggestion;

    if (!nextText.trim()) {
      setErrorMessage("AI suggestion is empty. Generate or edit a suggestion before applying it.");
      setPhase("error");
      return;
    }

    try {
      await onApply({
        text: nextText,
        mode,
        jobId,
        targetSelection: applySnapshot.selection,
        sourceText: applySnapshot.selectedText,
        edited: editableSuggestion !== generatedSuggestion,
      });
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not apply AI result.");
      setPhase("error");
    }
  }

  async function handleReject() {
    await onReject(jobId);
    await Promise.all([loadHistory(), loadUsage()]);
    onClose();
  }

  function handleCancel() {
    activeSessionRef.current?.cancel();
    setPhase("cancelled");
  }

  const canRun = selectedText.trim().length > 0 && phase !== "streaming";
  const hasPartialSelection = Boolean(
    suggestionSelection && suggestionSelection.end > suggestionSelection.start && editableSuggestion.length > 0
  );
  const previewSelectionText = phase === "completed" && runSnapshot ? runSnapshot.selectedText : selectedText;
  const selectionLength = snapshot.selection.end > snapshot.selection.start ? snapshot.selection.end - snapshot.selection.start : 0;

  const instructionLabel = action === "translate" ? "Translation notes" : action === "summarize" ? "Summary instruction" : "Rewrite instruction";
  const instructionPlaceholder = action === "translate"
    ? "Optional notes like formal tone, keep names unchanged, or use simple wording"
    : action === "summarize"
      ? "Optional notes like keep it to one sentence or use bullet points"
      : "Describe how the text should be rewritten";

  return (
    <>
      <aside className="side-panel side-panel-nonmodal" data-testid="ai-panel">
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
          <div>
            <p className="field-label" style={{ marginBottom: "0.5rem" }}>Action</p>
            <div className="ai-action-tabs">
              {ACTIONS.map((item) => (
                <button
                  key={item.value}
                  data-testid={`ai-action-${item.value}`}
                  className={`ai-tab${action === item.value ? " active" : ""}`}
                  onClick={() => {
                    setAction(item.value);
                    setPhase("idle");
                    setEditableSuggestion("");
                    setGeneratedSuggestion("");
                    setSuggestionSelection(null);
                    setErrorMessage(null);
                  }}
                >
                  {item.emoji} {item.label}
                </button>
              ))}
            </div>
          </div>

          {action === "translate" && (
            <div className="field">
              <label className="field-label" htmlFor="target-lang">Target language</label>
                <select
                  id="target-lang"
                  data-testid="ai-target-language"
                  className="text-input"
                value={targetLanguage}
                onChange={(event) => setTargetLanguage(event.target.value)}
              >
                {LANGUAGES.map((language) => (
                  <option key={language} value={language}>{language}</option>
                ))}
              </select>
            </div>
          )}

          <div className="field">
            <label className="field-label" htmlFor="ai-instruction">{instructionLabel}</label>
            <textarea
              id="ai-instruction"
              className="text-input"
              style={{ minHeight: 84, resize: "vertical" }}
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder={instructionPlaceholder}
            />
          </div>

          <div className="field">
            <p className="field-label">Selected text</p>
            {previewSelectionText.trim() ? (
              <div className="ai-selection-preview">{previewSelectionText}</div>
            ) : (
              <p className="field-hint" style={{ fontStyle: "italic" }}>
                No text selected. Select text in the editor or switch to the whole document.
              </p>
            )}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
              <span className="field-hint">
                Current range: {selectionLength > 0 ? `${selectionLength} characters selected` : "no active selection"}
              </span>
              {onUseWholeDocument && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={onUseWholeDocument}>
                  Use whole document
                </button>
              )}
            </div>
            <p className="field-hint">
              This panel stays open while you edit. Highlight a different range in the document, then run AI again.
            </p>
          </div>

            <div className="field ai-job-status-card">
            <p className="field-label">Job status</p>
            <div className="ai-job-status-row">
              <strong>{formatJobStatus(phase)}</strong>
              {jobId && <span className="field-hint">{jobId}</span>}
            </div>
          {phase === "streaming" && (
                <p className="field-hint">
                 Rendering the backend stream token by token.
                </p>
              )}
            {usage && (
              <p className="field-hint">
                Daily quota: {usage.usedToday}/{usage.dailyQuota} used today · {usage.remainingToday} remaining
              </p>
            )}
            {phase === "cancelled" && (
              <p className="field-hint">
                You can run the same request again or switch to a different AI action.
              </p>
            )}
          </div>

          {phase === "streaming" && (
            <div className="ai-spinner">
              <div className="spinner-ring" />
              <span>{formatJobStatus(phase)}</span>
            </div>
          )}

          {(phase === "streaming" || phase === "completed" || phase === "cancelled") && editableSuggestion && (
            <div className="field ai-review-grid">
              <div>
                <p className="field-label">Before</p>
                <div className="ai-selection-preview">{runSnapshot?.selectedText || previewSelectionText}</div>
              </div>
              <div>
                <p className="field-label">After</p>
                <textarea
                  ref={suggestionRef}
                  data-testid="ai-suggestion-editor"
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
                Review or edit the suggestion before applying. "Apply selection" uses only the highlighted portion.
              </p>
            </div>
          )}

          {phase === "error" && errorMessage && (
            <div className="status-banner status-error" role="alert">
              <strong>AI request failed</strong>
              <p>{errorMessage}</p>
            </div>
          )}

          <div className="field ai-history-card">
            <div className="dashboard-section-header">
              <h3>AI history</h3>
              <span>{historyItems.length}</span>
            </div>
            {historyItems.length === 0 ? (
              <p className="field-hint">Completed AI runs will appear here.</p>
            ) : (
              <div className="ai-history-list">
                {historyItems.map((item) => (
                  <div key={item.id} className="ai-history-item">
                    <div className="ai-history-item-top">
                      <strong>{item.promptLabel}</strong>
                      <span>{item.status}</span>
                    </div>
                    <p>{item.outputPreview || "No preview saved yet."}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="side-panel-footer">
          {phase === "completed" ? (
            <>
              <button className="btn btn-primary" data-testid="ai-apply-all" style={{ flex: 1 }} onClick={() => void handleApply("full")}>
                Apply all
              </button>
              <button
                className="btn btn-secondary"
                data-testid="ai-apply-selection"
                onClick={() => void handleApply("partial")}
                disabled={!hasPartialSelection}
              >
                Apply selection
              </button>
              <button className="btn btn-secondary" data-testid="ai-reject" onClick={() => void handleReject()}>
                Reject
              </button>
            </>
          ) : phase === "streaming" ? (
            <>
              <button className="btn btn-ai" style={{ flex: 1 }} disabled>
                Streaming...
              </button>
              <button className="btn btn-secondary" data-testid="ai-cancel" onClick={handleCancel}>
                Cancel stream
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-ai" data-testid="ai-run" style={{ flex: 1 }} onClick={handleRun} disabled={!canRun || (usage ? !usage.canUseAi : false)}>
                Run AI
              </button>
              <button className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
