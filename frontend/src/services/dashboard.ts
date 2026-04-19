import type { CreateDocumentResponse, GetDocumentResponse, ListDocumentsResponse } from "../types/api";
import type { ApiClient } from "./api";

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

export function createDashboardService(apiClient: ApiClient): DashboardService {
  return {
    async listDocuments(_userId) {
      const response: ListDocumentsResponse = await apiClient.listDocuments();
      return {
        owned: response.owned,
        shared: response.shared,
      };
    },

    async rememberCreatedDocument(_userId, _document) {
      return;
    },

    async rememberDocument(_userId, _document) {
      return;
    },
  };
}
