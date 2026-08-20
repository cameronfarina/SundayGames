import type { SyncedLeagueSettings } from "./contracts.js";
import { numberValue, optionalNumber, recordArray, recordValue, textValue } from "./decode.js";
import { espnLineupSlotNames } from "./espnCatalog.js";

/**
 * ESPN keys scoring by numeric stat id and Sleeper keys it by name. Naming the
 * stats both providers agree on lets one league detail view describe either
 * league in the same vocabulary; the rest of ESPN's 57 stat ids stay out.
 */
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

/**
 * ESPN reports slot counts, not a slot list. Expanding the counts back into a
 * flat list matches how Sleeper describes the same roster.
 */
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

/** ESPN also runs offline and autopick drafts, which name no format to import. */
const espnDraftType = (value: unknown): "auction" | "snake" | undefined => {
  const type = textValue(value).toUpperCase();
  if (type === "AUCTION") return "auction";
  return type === "SNAKE" ? "snake" : undefined;
};

/**
 * ESPN reports a keeper count of zero for redraft leagues rather than omitting
 * it, so the count is passed through as it stands and the import decides what
 * counts as a keeper league. ESPN publishes no auction minimum bid.
 */
export const espnDraftSettings = (
  settings: Record<string, unknown>,
): Pick<SyncedLeagueSettings, "auctionBudget" | "draftType" | "keeperCount"> => {
  const draft = recordValue(settings.draftSettings);
  const draftType = espnDraftType(draft.type);
  const auctionBudget = optionalNumber(draft.auctionBudget);
  const keeperCount = optionalNumber(draft.keeperCount);

  return {
    ...(draftType === undefined ? {} : { draftType }),
    ...(auctionBudget === undefined ? {} : { auctionBudget }),
    ...(keeperCount === undefined ? {} : { keeperCount }),
  };
};
