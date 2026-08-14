import type {
  LiveDraftSessionPaths,
  LiveDraftSessionSnapshot,
  SnapshotReadResult,
} from "./contracts.js";
import { readFileIfPresent } from "./fileSystem.js";
import { parseAuditLogSnapshot, parseSnapshot } from "./snapshotCodec.js";

const readSnapshotFile = async (path: string): Promise<SnapshotReadResult> => {
  const content = await readFileIfPresent(path);
  if (content === undefined) return { found: false };
  try {
    return { found: true, snapshot: parseSnapshot(content) };
  } catch {
    return { found: true };
  }
};

const readAuditLogSnapshot = async (path: string): Promise<SnapshotReadResult> => {
  const content = await readFileIfPresent(path);
  if (content === undefined) return { found: false };
  const snapshot = parseAuditLogSnapshot(content);
  return snapshot ? { found: true, snapshot } : { found: true };
};

export const recoverSessionSnapshot = async (
  paths: LiveDraftSessionPaths,
): Promise<LiveDraftSessionSnapshot | undefined> => {
  const current = await readSnapshotFile(paths.currentPath);
  if (current.snapshot) return current.snapshot;

  const backup = await readSnapshotFile(paths.backupPath);
  if (backup.snapshot) return backup.snapshot;

  const auditLog = await readAuditLogSnapshot(paths.logPath);
  if (auditLog.snapshot) return auditLog.snapshot;

  if (current.found || backup.found || auditLog.found) {
    throw new Error("Unable to recover live draft session from current, backup, or audit log files.");
  }
  return undefined;
};
