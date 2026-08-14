export type LiveDraftCommandImportFormat = "csv" | "json";

export type LiveDraftStoreMutation =
  | { type: "initialize" }
  | { type: "sale"; command: string }
  | { type: "undo"; removedCommand?: string }
  | { type: "reset"; previousCommandCount: number }
  | { type: "import"; importedCount: number; previousCommandCount: number };

export interface LiveDraftSessionPaths {
  directory: string;
  logPath: string;
  currentPath: string;
  backupPath: string;
}

export interface LiveDraftSessionSnapshot {
  version: 1;
  updatedAt: string;
  commandCount: number;
  commands: string[];
  lastMutation: LiveDraftStoreMutation;
}

export interface LiveDraftAuditLogEntry extends LiveDraftSessionSnapshot {
  sequence: number;
  timestamp: string;
  mutation: LiveDraftStoreMutation;
}

export interface LiveDraftSessionStatus {
  commandCount: number;
  paths: LiveDraftSessionPaths;
  loadedAt?: string;
}

export interface FileBackedLiveDraftSessionStoreOptions {
  directory?: string;
}

export interface SnapshotReadResult {
  found: boolean;
  snapshot?: LiveDraftSessionSnapshot;
}
