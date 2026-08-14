import type { SnakeDraftCommand } from "../snakeDraftEngine/command.js";
import type { SnakeDraftConfig } from "../snakeDraftEngine/config.js";
import type { SnakeDraftState } from "../snakeDraftEngine/readModels.js";
import { replaySnakeDraft } from "../snakeDraftEngine/replay.js";
import { invalidSnakeCommand } from "./errors.js";

const objectRecord = (value: unknown): Record<string, unknown> | null =>
  value === null || typeof value !== "object" || Array.isArray(value)
    ? null
    : Object.fromEntries(Object.entries(value));

const commandFromJson = (value: string): SnakeDraftCommand => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return invalidSnakeCommand();
  }
  const record = objectRecord(parsed);
  if (record === null || !Number.isInteger(record.expectedRevision)) {
    return invalidSnakeCommand();
  }
  const expectedRevision = Number(record.expectedRevision);
  if (record.type === "start" || record.type === "undo" || record.type === "complete") {
    return { type: record.type, expectedRevision };
  }
  if (record.type === "pick" && typeof record.playerId === "string" && record.playerId.length > 0) {
    return { type: "pick", expectedRevision, playerId: record.playerId };
  }
  return invalidSnakeCommand();
};

export const replaySeasonSnakeMockCommands = (
  config: SnakeDraftConfig,
  commandLog: readonly string[],
): SnakeDraftState => replaySnakeDraft(config, commandLog.map(commandFromJson));
