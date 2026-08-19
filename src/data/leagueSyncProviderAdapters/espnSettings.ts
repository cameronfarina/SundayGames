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
