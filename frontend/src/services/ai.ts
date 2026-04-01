import type {
  AiJobResponse,
  TextSelection,
} from "../types/api";
import type { ApiClient } from "./api";

export type AiJobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

export interface PollJobOptions {
  userId?: string;
  onStatusChange?(job: AiJobResponse): void;
}

export interface AiService {
  requestRewrite(
    documentId: string,
    snapshot: AiSelectionSnapshot,
    instruction?: string
  ): Promise<AiJobResponse>;
  requestSummarize(documentId: string, snapshot: AiSelectionSnapshot): Promise<AiJobResponse>;
  requestTranslate(
    documentId: string,
    snapshot: AiSelectionSnapshot,
    targetLanguage: string
  ): Promise<AiJobResponse>;
  pollJobUntilDone(jobId: string, options?: PollJobOptions): Promise<AiJobResponse>;
}

export interface AiSelectionSnapshot {
  selection: TextSelection;
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  baseVersionId: string;
}

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 20;

export function createAiService(apiClient: ApiClient, userId?: string): AiService {
  function makeRequestId(prefix: string): string {
    return `req_${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  }

  async function pollJobUntilDone(jobId: string, options: PollJobOptions = {}): Promise<AiJobResponse> {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      const job = await apiClient.getAiJobStatus(jobId, options.userId ?? userId);
      options.onStatusChange?.(job);

      if (job.status === "SUCCEEDED" || job.status === "FAILED") {
        return job;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    return {
      jobId,
      statusUrl: "",
      status: "FAILED",
      errorMessage: "AI_TIMEOUT: job did not complete in time",
    };
  }

  return {
    requestRewrite: (documentId, snapshot, instruction = "Rewrite this selection") =>
      apiClient.requestRewriteJob(
        {
          documentId,
          ...snapshot,
          instruction,
          requestId: makeRequestId("ai_rewrite"),
        },
        userId
      ),
    requestSummarize: (documentId, snapshot) =>
      apiClient.requestSummarizeJob(
        {
          documentId,
          ...snapshot,
          requestId: makeRequestId("ai_summarize"),
        },
        userId
      ),
    requestTranslate: (documentId, snapshot, targetLanguage) =>
      apiClient.requestTranslateJob(
        {
          documentId,
          ...snapshot,
          targetLanguage,
          requestId: makeRequestId("ai_translate"),
        },
        userId
      ),
    pollJobUntilDone,
  };
}
