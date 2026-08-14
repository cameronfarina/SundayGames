import type { Position } from "../../../config/league.js";
import {
  normalizeLeagueSeasonSettings,
  type LeagueSeason,
} from "../leagueSeason.js";
import type { PostDraftStarterSlot } from "../postDraftTeamAnalysis.js";
import { PostDraftLiveRoomAdapterError } from "./errors.js";

const eligiblePositionsBySlot: Readonly<Record<string, readonly Position[]>> = {
  QB: ["QB"],
  RB: ["RB"],
  RB_WR: ["RB", "WR"],
  WR: ["WR"],
  WR_TE: ["WR", "TE"],
  TE: ["TE"],
  OP: ["QB", "RB", "WR", "TE"],
  FLEX: ["RB", "WR", "TE"],
  K: ["K"],
  DST: ["DST"],
};
const nonStarterSlots = new Set(["BENCH", "IR"]);

const slotsForLineupEntry = (slot: string, count: number): PostDraftStarterSlot[] => {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new PostDraftLiveRoomAdapterError(
      "context_mismatch",
      `Live draft room has an invalid count for lineup slot ${slot}.`,
    );
  }
  if (count === 0 || nonStarterSlots.has(slot)) return [];

  const eligiblePositions = eligiblePositionsBySlot[slot];
  if (eligiblePositions === undefined) {
    throw new PostDraftLiveRoomAdapterError(
      "context_mismatch",
      `Live draft room uses unsupported starter slot ${slot}.`,
    );
  }
  return Array.from({ length: count }, (_, index) => ({
    slot: count === 1 ? slot : `${slot}${index + 1}`,
    eligiblePositions,
  }));
};

export const starterSlotsFor = (season: LeagueSeason): PostDraftStarterSlot[] =>
  Object.entries(normalizeLeagueSeasonSettings(season.settings).roster.lineup)
    .flatMap(([slot, count]) => slotsForLineupEntry(slot, count));
