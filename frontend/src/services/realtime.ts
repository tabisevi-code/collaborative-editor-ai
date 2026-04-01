/**
 * These types define the minimum contract the future realtime module should
 * satisfy. Keeping the interface here prevents page components from depending
 * on any specific WebSocket library too early.
 */
export interface PresenceEvent {
  documentId: string;
  userId: string;
  state: "online" | "offline";
}

export interface RemoteSelectionEvent {
  documentId: string;
  userId: string;
  start: number;
  end: number;
}

export interface RealtimeService {
  connect(documentId: string): Promise<void>;
  disconnect(): Promise<void>;
}

// TODO: Implement the real WebSocket-backed collaboration service.
