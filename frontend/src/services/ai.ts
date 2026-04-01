import type { AiJobResponse, TextSelection } from "../types/api";
import type { ApiClient } from "./api";

export type AiJobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

export interface AiService {
  requestRewrite(documentId: string, selection: TextSelection, instruction?: string): Promise<AiJobResponse>;
  requestSummarize(documentId: string, selection: TextSelection): Promise<AiJobResponse>;
  requestTranslate(documentId: string, selection: TextSelection, targetLanguage: string): Promise<AiJobResponse>;
  pollJobUntilDone(jobId: string, userId?: string): Promise<AiJobResponse>;
}

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 20;

export function createAiService(apiClient: ApiClient, userId?: string): AiService {
  function makeRequestId(prefix: string): string {
    return `req_${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  }

  async function pollJobUntilDone(jobId: string, pollUserId?: string): Promise<AiJobResponse> {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      const job = await apiClient.getAiJobStatus(jobId, pollUserId ?? userId);

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
    requestRewrite: (documentId, selection, instruction = "Rewrite this selection") =>
      apiClient.requestRewriteJob(
        {
          documentId,
          selection,
          instruction,
          requestId: makeRequestId("ai_rewrite"),
        },
        userId
      ),
    requestSummarize: (documentId, selection) =>
      apiClient.requestSummarizeJob(
        {
          documentId,
          selection,
          requestId: makeRequestId("ai_summarize"),
        },
        userId
      ),
    requestTranslate: (documentId, selection, targetLanguage) =>
      apiClient.requestTranslateJob(
        {
          documentId,
          selection,
          targetLanguage,
          requestId: makeRequestId("ai_translate"),
        },
        userId
      ),
    pollJobUntilDone,
  };
}
