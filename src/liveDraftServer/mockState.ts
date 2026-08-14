import { ownerOrder } from "../../config/league.js";
import type { LiveDraftStrategyKey } from "../modeling/liveDraftStrategies.js";
import { unknownField } from "./unknownRecord.js";

export const mockSpeedActions = new Set([
  "next-ai-sale",
  "next-cam-decision",
  "next-round",
  "complete-mock",
]);

export const optionalCommandFromInteractiveMockAction = (
  result: unknown,
): string | undefined => {
  const command = unknownField(result, "command");
  return typeof command === "string" && command.trim() ? command.trim() : undefined;
};

export const mockDraftFromInteractiveMockAction = (result: unknown): unknown | undefined => {
  const mockDraft = unknownField(result, "mockDraft");
  return typeof mockDraft === "object" && mockDraft !== null ? mockDraft : undefined;
};

export const mockAuctionFromValue = (value: unknown): unknown | undefined =>
  typeof value === "object" && value !== null ? value : undefined;

export const mockAuctionPlayerFromValue = (value: unknown): string | undefined => {
  const player = unknownField(value, "player");
  return typeof player === "string" && player.trim() ? player.trim() : undefined;
};

export const mockAuctionOpeningBidFromValue = (value: unknown): number | undefined => {
  const openingBid = unknownField(value, "openingBid");
  return typeof openingBid === "number" && Number.isInteger(openingBid) && openingBid > 0
    ? openingBid
    : undefined;
};

export const mockDraftWithClientAuction = (
  mockDraft: unknown,
  mockAuction: unknown | undefined,
): unknown => {
  if (!mockAuction || typeof mockDraft !== "object" || mockDraft === null) return mockDraft;
  return Object.assign({}, mockDraft, { auction: mockAuction });
};

export const mockDraftRequestFor = (
  strategyKey: LiveDraftStrategyKey,
  seed: string | undefined,
  nominatedPlayer?: string,
  nominatedPrice?: number,
): {
  strategyKey: LiveDraftStrategyKey;
  seed?: string;
  nominatedPlayer?: string;
  nominatedPrice?: number;
} => ({
  strategyKey,
  ...(seed === undefined ? {} : { seed }),
  ...(nominatedPlayer === undefined ? {} : { nominatedPlayer }),
  ...(nominatedPrice === undefined ? {} : { nominatedPrice }),
});

export const mockDraftPhaseFor = (mockDraft: unknown): string => {
  const phase = unknownField(mockDraft, "phase");
  return typeof phase === "string" ? phase : "";
};

export const mockDraftPickNumberFor = (mockDraft: unknown): number => {
  const pick = unknownField(mockDraft, "pickNumber");
  return typeof pick === "number" && Number.isFinite(pick) ? pick : 1;
};

export const mockDraftTopTargetNameFor = (mockDraft: unknown): string | undefined => {
  const targets = unknownField(mockDraft, "topTargets");
  if (!Array.isArray(targets)) return undefined;
  const name = unknownField(targets[0], "name");
  return typeof name === "string" && name.trim() ? name.trim() : undefined;
};

export const mockDraftRoundForPick = (pickNumber: number): number =>
  Math.floor((Math.max(1, pickNumber) - 1) / ownerOrder.length);
