import type { LiveDraftCommandImportFormat } from "./contracts.js";
import { liveDraftCommandsCsv, parseCsvRows } from "./csvCodec.js";
import { snapshotVersion } from "./snapshotCodec.js";
import { isObjectRecord, validateCommandList } from "./valueGuards.js";

export { liveDraftCommandsCsv } from "./csvCodec.js";

export const liveDraftCommandsJson = (commands: readonly string[]): string =>
  `${JSON.stringify({ version: snapshotVersion, commands: [...commands] }, null, 2)}\n`;

const commandsFromSnapshotValue = (value: unknown): unknown =>
  isObjectRecord(value) && "commands" in value ? value.commands : undefined;

const commandsFromJsonImportObject = (value: Record<string, unknown>): unknown => {
  if ("commands" in value) return value.commands;
  return commandsFromSnapshotValue(value.currentSnapshot) ??
    commandsFromSnapshotValue(value.backupSnapshot);
};

const parseJsonImport = (content: string): string[] => {
  const parsed: unknown = JSON.parse(content);
  if (Array.isArray(parsed)) return validateCommandList(parsed);
  if (isObjectRecord(parsed)) {
    const commands = commandsFromJsonImportObject(parsed);
    if (commands !== undefined) return validateCommandList(commands);
    if (typeof parsed.commandsJson === "string") {
      return parseJsonImport(parsed.commandsJson);
    }
  }
  throw new Error(
    "JSON draft-log import must be an array, an object with commands, or a Mockd session bundle.",
  );
};

const parseCsvImport = (content: string): string[] => {
  const rows = parseCsvRows(content);
  const header = rows[0]?.map(cell => cell.trim().toLowerCase());
  const commandIndex = header?.indexOf("command") ?? -1;
  if (!header || commandIndex < 0) {
    throw new Error("CSV draft-log import must include a command column.");
  }
  return validateCommandList(rows.slice(1).map(row => row[commandIndex] ?? ""));
};

export const parseLiveDraftCommandImport = (
  content: string,
  format: LiveDraftCommandImportFormat,
): string[] => format === "json" ? parseJsonImport(content) : parseCsvImport(content);
