import { appendFile, mkdir, rename, rm, writeFile } from "node:fs/promises";
import type {
  LiveDraftAuditLogEntry,
  LiveDraftSessionPaths,
  LiveDraftStoreMutation,
} from "./contracts.js";
import { auditLineCount, readFileIfPresent, restoreFile } from "./fileSystem.js";
import { snapshotFor } from "./snapshotCodec.js";

const rollback = async (
  paths: LiveDraftSessionPaths,
  currentTempPath: string,
  backupTempPath: string,
  previousCurrentContent: string | undefined,
  previousBackupContent: string | undefined,
): Promise<void> => {
  await Promise.allSettled([
    restoreFile(paths.currentPath, previousCurrentContent),
    restoreFile(paths.backupPath, previousBackupContent),
    rm(currentTempPath, { force: true }),
    rm(backupTempPath, { force: true }),
  ]);
};

export const persistSession = async (
  paths: LiveDraftSessionPaths,
  mutation: LiveDraftStoreMutation,
  nextCommands: readonly string[],
): Promise<string> => {
  await mkdir(paths.directory, { recursive: true });
  const timestamp = new Date().toISOString();
  const snapshot = snapshotFor(nextCommands, mutation, timestamp);
  const snapshotContent = `${JSON.stringify(snapshot, null, 2)}\n`;
  const sequence = await auditLineCount(paths.logPath) + 1;
  const auditEntry: LiveDraftAuditLogEntry = {
    ...snapshot,
    sequence,
    timestamp,
    mutation,
  };
  const currentTempPath = `${paths.currentPath}.tmp`;
  const backupTempPath = `${paths.backupPath}.tmp`;
  const previousCurrentContent = await readFileIfPresent(paths.currentPath);
  const previousBackupContent = await readFileIfPresent(paths.backupPath);

  try {
    await writeFile(currentTempPath, snapshotContent, "utf8");
    await writeFile(backupTempPath, snapshotContent, "utf8");
    await rename(currentTempPath, paths.currentPath);
    await rename(backupTempPath, paths.backupPath);
    await appendFile(paths.logPath, `${JSON.stringify(auditEntry)}\n`, "utf8");
  } catch (error) {
    await rollback(
      paths,
      currentTempPath,
      backupTempPath,
      previousCurrentContent,
      previousBackupContent,
    );
    throw error;
  }
  return timestamp;
};
