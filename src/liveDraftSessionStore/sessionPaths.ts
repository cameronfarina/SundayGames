import { join } from "node:path";
import type { LiveDraftSessionPaths } from "./contracts.js";

const defaultSessionDirectory = "data/live-draft";

export const createSessionPaths = (directory = defaultSessionDirectory): LiveDraftSessionPaths => ({
  directory,
  logPath: join(directory, "live-draft-log.jsonl"),
  currentPath: join(directory, "live-draft-current.json"),
  backupPath: join(directory, "live-draft-backup.json"),
});
