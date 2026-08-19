import type { SyncedLeagueDraft } from "./contracts.js";
import {
  arrayValue,
  numberValue,
  optionalNumber,
  optionalText,
  recordArray,
  recordValue,
  textValue,
} from "./decode.js";
import { espnLineupSlotNames } from "./espnCatalog.js";

export const espnScoringStatNames: Readonly<Record<string, string>> = {
  "3": "pass_yd",
  "4": "pass_td",
  "24": "rush_yd",
  "25": "rush_td",
  "42": "rec_yd",
  "43": "rec_td",
  "53": "rec",
};

export const espnScoring = (
  settings: Record<string, unknown>,
): Readonly<Record<string, number>> => {
  const scoring: Record<string, number> = {};
  for (const item of recordArray(recordValue(settings.scoringSettings).scoringItems)) {
    const name = espnScoringStatNames[textValue(item.statId)];
    const points = optionalNumber(item.points);
    if (name !== undefined && points !== undefined) scoring[name] = points;
  }
  return scoring;
};

export const espnRosterPositions = (
  settings: Record<string, unknown>,
): readonly string[] => {
  const counts = recordValue(recordValue(settings.rosterSettings).lineupSlotCounts);
  return Object.entries(counts)
    .map(([slotId, count]) => ({ count: Math.max(0, Math.trunc(numberValue(count))), slotId }))
    .filter(slot => slot.count > 0)
    .sort((left, right) => Number(left.slotId) - Number(right.slotId))
    .flatMap(slot => Array.from(
      { length: slot.count },
      () => espnLineupSlotNames[slot.slotId] ?? slot.slotId,
    ));
};

const positiveInteger = (value: unknown): number | undefined => {
  const parsed = numberValue(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const pickOrderFor = (draftSettings: Record<string, unknown>): readonly string[] =>
  arrayValue(draftSettings.pickOrder)
    .map(optionalText)
    .filter((value): value is string => value !== undefined);

export const espnDraft = (
  settings: Record<string, unknown>,
  rosterPositions: readonly string[],
): SyncedLeagueDraft | undefined => {
  const draftSettings = recordValue(settings.draftSettings);
  const type = optionalText(draftSettings.type)?.toUpperCase();
  if (type === "AUCTION") {
    const budgetDollars = positiveInteger(draftSettings.auctionBudget);
    if (budgetDollars === undefined) return undefined;
    return {
      type: "auction",
      budgetDollars,
      minimumBidDollars: positiveInteger(draftSettings.minimumBid) ?? 1,
    };
  }
  if (type !== "SNAKE") return undefined;
  const order = pickOrderFor(draftSettings);
  if (order.length === 0) return undefined;
  const draftableRosterSize = rosterPositions.filter(slot => !["IR", "ER"].includes(slot)).length;
  return {
    type: "snake",
    rounds: positiveInteger(draftSettings.rounds) ?? draftableRosterSize,
    order,
  };
};

export const espnKeeperLeague = (
  settings: Record<string, unknown>,
): boolean | undefined => {
  const draftSettings = recordValue(settings.draftSettings);
  const keeperCount = optionalNumber(draftSettings.keeperCount);
  return keeperCount === undefined ? undefined : keeperCount > 0;
};
