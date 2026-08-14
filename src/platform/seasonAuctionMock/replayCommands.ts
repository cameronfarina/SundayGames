import {
  replayGenericAuctionMock,
  type GenericAuctionMockCommand,
  type GenericAuctionMockConfig,
  type GenericAuctionMockState,
} from "../genericAuctionMockEngine.js";
import { invalidAuctionCommand } from "./errors.js";

const objectRecord = (value: unknown): Record<string, unknown> | null =>
  value === null || typeof value !== "object" || Array.isArray(value)
    ? null
    : Object.fromEntries(Object.entries(value));

const commandFromJson = (value: string): GenericAuctionMockCommand => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return invalidAuctionCommand();
  }
  const record = objectRecord(parsed);
  if (record === null || !Number.isInteger(record.expectedRevision)) return invalidAuctionCommand();
  const expectedRevision = Number(record.expectedRevision);
  if (record.type === "start" || record.type === "pass" || record.type === "undo" || record.type === "complete") {
    return { type: record.type, expectedRevision };
  }
  if (record.type === "nominate" && typeof record.playerId === "string" && record.playerId.length > 0) {
    const openingBid = record.openingBid;
    if (openingBid !== undefined && typeof openingBid !== "number") return invalidAuctionCommand();
    return { type: "nominate", expectedRevision, playerId: record.playerId,
      ...(openingBid === undefined ? {} : { openingBid }) };
  }
  if (record.type === "buy" && typeof record.price === "number") {
    return { type: "buy", expectedRevision, price: record.price };
  }
  return invalidAuctionCommand();
};

export const replaySeasonAuctionMockCommands = (
  config: GenericAuctionMockConfig,
  commandLog: readonly string[],
): GenericAuctionMockState => replayGenericAuctionMock(config, commandLog.map(commandFromJson));
