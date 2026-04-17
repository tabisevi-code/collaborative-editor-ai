import type { CreateDocumentResponse, GetDocumentResponse } from "../types/api";

export interface DashboardDocumentSummary {
  documentId: string;
  title: string;
  role: "owner" | "editor" | "viewer";
  updatedAt: string;
  ownerDisplayName?: string;
}

export interface DashboardData {
  owned: DashboardDocumentSummary[];
  shared: DashboardDocumentSummary[];
}

export interface DashboardService {
  listDocuments(userId: string): Promise<DashboardData>;
  rememberCreatedDocument(userId: string, document: CreateDocumentResponse): Promise<void>;
  rememberDocument(userId: string, document: GetDocumentResponse): Promise<void>;
}

interface DashboardStoreShape {
  [userId: string]: {
    owned: DashboardDocumentSummary[];
    shared: DashboardDocumentSummary[];
  };
}

const DASHBOARD_STORAGE_KEY = "collaborative-editor-ai.dashboard";

function hasWindowStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStore(): DashboardStoreShape {
  if (!hasWindowStorage()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(DASHBOARD_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? (parsed as DashboardStoreShape) : {};
  } catch (error) {
    console.warn("[dashboard-service] failed_to_read_store", {
      message: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}

function writeStore(nextStore: DashboardStoreShape) {
  if (!hasWindowStorage()) {
    return;
  }

  window.localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(nextStore));
}

function sortDocuments(documents: DashboardDocumentSummary[]) {
  return [...documents].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

function upsertDocument(
  documents: DashboardDocumentSummary[],
  nextDocument: DashboardDocumentSummary
): DashboardDocumentSummary[] {
  const nextDocuments = documents.filter((document) => document.documentId !== nextDocument.documentId);
  nextDocuments.unshift(nextDocument);
  return sortDocuments(nextDocuments);
}

/**
 * The backend does not expose a document dashboard endpoint yet, so the
 * frontend keeps evaluator-visible dashboard flows moving by storing the
 * documents each user creates or opens locally.
 */
export function createDashboardService(): DashboardService {
  return {
    async listDocuments(userId) {
      const store = readStore();
      const userStore = store[userId] || { owned: [], shared: [] };
      console.info("[dashboard-service] list_documents", {
        userId,
        owned: userStore.owned.length,
        shared: userStore.shared.length,
      });
      return {
        owned: sortDocuments(userStore.owned),
        shared: sortDocuments(userStore.shared),
      };
    },

    async rememberCreatedDocument(userId, document) {
      const store = readStore();
      const userStore = store[userId] || { owned: [], shared: [] };
      userStore.owned = upsertDocument(userStore.owned, {
        documentId: document.documentId,
        title: document.title,
        role: "owner",
        updatedAt: document.updatedAt,
        ownerDisplayName: userId,
      });
      store[userId] = userStore;
      console.info("[dashboard-service] remember_created_document", {
        userId,
        documentId: document.documentId,
      });
      writeStore(store);
    },

    async rememberDocument(userId, document) {
      const store = readStore();
      const userStore = store[userId] || { owned: [], shared: [] };
      const summary: DashboardDocumentSummary = {
        documentId: document.documentId,
        title: document.title,
        role: document.role,
        updatedAt: document.updatedAt,
        ownerDisplayName: document.role === "owner" ? userId : undefined,
      };

      if (document.role === "owner") {
        userStore.owned = upsertDocument(userStore.owned, summary);
        userStore.shared = userStore.shared.filter((item) => item.documentId !== document.documentId);
      } else {
        userStore.shared = upsertDocument(userStore.shared, summary);
      }

      store[userId] = userStore;
      console.info("[dashboard-service] remember_document", {
        userId,
        documentId: document.documentId,
        role: document.role,
      });
      writeStore(store);
    },
  };
}
