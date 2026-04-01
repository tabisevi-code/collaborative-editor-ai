import { useEffect, useRef, useState } from "react";

import type { ApiClient } from "../services/api";
import {
  createRealtimeService,
  type RealtimeConnectionState,
  type RealtimeService,
  type RemotePeer,
} from "../services/realtime";
import type { DocumentRole, GetDocumentResponse, TextSelection } from "../types/api";

interface UseRealtimeDocumentOptions {
  apiClient: ApiClient;
  document: GetDocumentResponse | null;
  userId: string;
  onDocumentReverted?(): void;
  onAccessRevoked?(): void;
}

export function useRealtimeDocument({
  apiClient,
  document,
  userId,
  onDocumentReverted,
  onAccessRevoked,
}: UseRealtimeDocumentOptions) {
  const [role, setRole] = useState<DocumentRole>("viewer");
  const [collaborationText, setCollaborationText] = useState("");
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [realtimeState, setRealtimeState] = useState<RealtimeConnectionState>("idle");
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [collaborationReady, setCollaborationReady] = useState(false);
  const [accessRevoked, setAccessRevoked] = useState(false);

  const realtimeServiceRef = useRef<RealtimeService | null>(null);
  const onDocumentRevertedRef = useRef(onDocumentReverted);
  const onAccessRevokedRef = useRef(onAccessRevoked);

  if (!realtimeServiceRef.current) {
    realtimeServiceRef.current = createRealtimeService(apiClient);
  }

  useEffect(() => {
    onDocumentRevertedRef.current = onDocumentReverted;
  }, [onDocumentReverted]);

  useEffect(() => {
    onAccessRevokedRef.current = onAccessRevoked;
  }, [onAccessRevoked]);

  useEffect(() => {
    realtimeServiceRef.current?.disconnect();
    realtimeServiceRef.current = createRealtimeService(apiClient);

    return () => {
      realtimeServiceRef.current?.disconnect();
    };
  }, [apiClient, document?.documentId]);

  useEffect(() => {
    if (!document) {
      setRole("viewer");
      setCollaborationText("");
      setRemotePeers([]);
      setRealtimeState("idle");
      setRealtimeError(null);
      setCollaborationReady(false);
      setAccessRevoked(false);
      return;
    }

    setRole(document.role);
    setRealtimeError(null);
    setAccessRevoked(false);
  }, [document]);

  useEffect(() => {
    if (!document) {
      return;
    }

    const realtimeService = realtimeServiceRef.current;
    if (!realtimeService) {
      return;
    }

    setRealtimeError(null);
    setRemotePeers([]);
    setCollaborationReady(false);
    setCollaborationText("");

    void realtimeService.connect(document.documentId, {
      userId,
      role: document.role,
      initialContent: document.content,
      onConnectionStateChange: (nextState) => {
        setRealtimeState(nextState);
        if (nextState === "connected") {
          setCollaborationReady(true);
          setCollaborationText(realtimeService.getText());
        }
      },
      onTextChange: (text) => {
        setCollaborationText(text);
      },
      onPeersChange: (peers) => {
        setRemotePeers(peers);
      },
      onPermissionChange: (nextRole) => {
        setRole(nextRole);
      },
      onDocumentReverted: () => {
        onDocumentRevertedRef.current?.();
      },
      onAccessRevoked: () => {
        setAccessRevoked(true);
        setRole("viewer");
        onAccessRevokedRef.current?.();
      },
      onError: (message) => {
        setRealtimeError(message);
      },
    });

    return () => {
      realtimeService.disconnect();
      setRemotePeers([]);
    };
  }, [apiClient, document?.documentId, document?.revisionId, userId]);

  return {
    role,
    collaborationText,
    remotePeers,
    realtimeState,
    realtimeError,
    collaborationReady,
    accessRevoked,
    getText() {
      return realtimeServiceRef.current?.getText() || "";
    },
    applyLocalChange(nextText: string) {
      return realtimeServiceRef.current?.applyLocalChange(nextText) || false;
    },
    replaceSelection(selection: TextSelection, replacement: string) {
      return realtimeServiceRef.current?.replaceSelection(selection, replacement) || false;
    },
    setCursorSelection(selection: TextSelection | null) {
      realtimeServiceRef.current?.setCursorSelection(selection);
    },
    applyRemoteReset(content: string) {
      realtimeServiceRef.current?.applyRemoteReset(content);
    },
  };
}
