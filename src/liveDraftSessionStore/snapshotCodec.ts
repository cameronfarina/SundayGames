import type {
  LiveDraftSessionSnapshot,
  LiveDraftStoreMutation,
} from "./contracts.js";
import { parseMutation } from "./mutationCodec.js";
import { isObjectRecord, validateCommandList } from "./valueGuards.js";

export const snapshotVersion = 1;

export const snapshotFor = (
  commands: readonly string[],
  mutation: LiveDraftStoreMutation,
  timestamp: string,
): LiveDraftSessionSnapshot => ({
  version: snapshotVersion,
  updatedAt: timestamp,
  commandCount: commands.length,
  commands: [...commands],
  lastMutation: mutation,
});

export const parseSnapshot = (content: string): LiveDraftSessionSnapshot => {
  const value: unknown = JSON.parse(content);
  if (!isObjectRecord(value) || value.version !== snapshotVersion) {
    throw new Error("Unsupported live draft snapshot version.");
  }
  const commands = validateCommandList(value.commands);
  return {
    version: snapshotVersion,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
    commandCount: commands.length,
    commands,
    lastMutation: parseMutation(value.lastMutation),
  };
};

export const parseAuditLogSnapshot = (content: string): LiveDraftSessionSnapshot | undefined => {
  const lines = content.trim().split("\n").filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return parseSnapshot(lines[index] ?? "");
    } catch {
      // A partially-written trailing line should not block recovery from older entries.
    }
  }
  return undefined;
};
