import { LeagueCreationError } from "../leagueCreation.js";
import { rosterSlotNames } from "./constants.js";
import { finiteNumber, requiredObject, type JsonObject } from "./json.js";

export const rosterSlotsFor = (
  rosterSettings: JsonObject,
): Readonly<Record<string, number>> => {
  const counts = requiredObject(
    rosterSettings.lineupSlotCounts,
    "settings.rosterSettings.lineupSlotCounts",
  );
  const slots: Record<string, number> = {};

  for (const [slotId, rawCount] of Object.entries(counts)) {
    const count = finiteNumber(rawCount);
    if (count === null || count <= 0) continue;
    const slotName = rosterSlotNames[slotId];
    if (slotName === undefined) {
      throw new LeagueCreationError(
        `ESPN roster slot ${slotId} is not supported. Review the league roster settings manually before continuing.`,
      );
    }
    slots[slotName] = count;
  }

  return slots;
};
