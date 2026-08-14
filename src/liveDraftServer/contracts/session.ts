import type { LiveDraftSessionStatus } from "../../liveDraftSessionStore.js";
import type { LiveDraftReadiness, LiveDraftState } from "../../modeling/liveDraft.js";

export type LiveDraftSessionMode = "real" | "interactive-mock";

export interface LiveDraftSessionDescriptor {
  key: string;
  label: string;
  description: string;
}

export interface LiveDraftModeDescriptor {
  key: LiveDraftSessionMode;
  label: string;
  description: string;
}

export interface DraftNightLockStatus {
  locked: boolean;
  reason?: string;
}

export interface LiveDraftStateResponse extends LiveDraftState {
  draftMode: LiveDraftSessionMode;
  draftModes: readonly LiveDraftModeDescriptor[];
  activeDraftSession: LiveDraftSessionDescriptor;
  draftSessions: readonly LiveDraftSessionDescriptor[];
  draftNightLock: DraftNightLockStatus;
  session: LiveDraftSessionStatus;
  readiness: LiveDraftReadiness;
}

export interface LiveDraftSessionExportBundle {
  version: 1;
  exportedAt: string;
  activeDraftSession: LiveDraftSessionDescriptor;
  draftMode: LiveDraftSessionMode;
  session: LiveDraftSessionStatus;
  readiness: LiveDraftReadiness;
  currentSnapshot: unknown | null;
  backupSnapshot: unknown | null;
  auditLogJsonl: string;
  commandsJson: string;
  commandsCsv: string;
}
