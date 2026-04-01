import type { RealtimeConnectionState } from "../services/realtime";
import { ApiError, type DocumentRole } from "../types/api";

export type SaveState = "saved" | "unsaved" | "saving" | "error";

export function mapDocumentError(error: ApiError): string {
  if (error.status === 404) return "Document not found.";
  if (error.status === 401) return "Authentication is required. Refresh and sign in again.";
  if (error.status === 403) return "You no longer have permission to open this document.";
  if (error.code === "NETWORK_ERROR") return "Backend unavailable. Start the backend service and refresh.";
  return error.message || "The document could not be loaded.";
}

export function mapSaveError(error: unknown): { message: string; stale: boolean } {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return {
        message: "Your draft is based on an older revision. Reload the latest saved version before saving again.",
        stale: true,
      };
    }

    if (error.status === 403) {
      return {
        message: "You do not have permission to save this document.",
        stale: false,
      };
    }

    if (error.status === 413) {
      return {
        message: error.message || "The document content exceeds the backend size limit.",
        stale: false,
      };
    }

    if (error.code === "NETWORK_ERROR") {
      return {
        message: "Backend unavailable. Start the backend service and try saving again.",
        stale: false,
      };
    }

    return {
      message: error.message || "Could not save this document.",
      stale: false,
    };
  }

  return {
    message: "Could not save this document.",
    stale: false,
  };
}

export function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

export function toRealtimeStatusLabel(state: RealtimeConnectionState, peerCount: number): string {
  if (state === "connected") {
    return peerCount > 0 ? `Live with ${peerCount + 1} participants` : "Live sync connected";
  }

  if (state === "connecting") {
    return "Connecting live sync…";
  }

  if (state === "error") {
    return "Live sync unavailable";
  }

  if (state === "closed") {
    return "Live sync offline";
  }

  return "Live sync idle";
}

export function isViewerRole(role: DocumentRole): boolean {
  return role === "viewer";
}
