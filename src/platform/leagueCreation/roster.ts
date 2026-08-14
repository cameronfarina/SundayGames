import type { LineupSettings, RosterMaximums } from "../leagueSeason.js";
import { LeagueCreationError } from "./errors.js";
import { normalizedRosterSlotKey, rosterSlotDefinitions } from "./rosterDefinitions.js";
import type { DraftableRosterSlotAnalysis, RosterSlotAnalysis } from "./types.js";

export const analyzeRosterSlots = (
  lineup: Readonly<Record<string, number>>,
): RosterSlotAnalysis => {
  const draftableSlots: DraftableRosterSlotAnalysis[] = [];
  const unsupportedSlots: string[] = [];
  const rosterMaximums: RosterMaximums = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };

  for (const [slot, count] of Object.entries(lineup)) {
    if (!Number.isInteger(count) || count <= 0) continue;
    const definition = rosterSlotDefinitions[normalizedRosterSlotKey(slot)];
    if (definition === undefined) {
      unsupportedSlots.push(slot);
      continue;
    }
    if (!definition.draftable) continue;
    const configured = draftableSlots.find(candidate => candidate.slot === definition.canonicalSlot);
    if (configured === undefined) {
      draftableSlots.push({
        slot: definition.canonicalSlot,
        count,
        eligiblePositions: definition.eligiblePositions,
      });
    } else {
      configured.count += count;
    }
    for (const position of definition.eligiblePositions) rosterMaximums[position] += count;
  }

  return {
    draftableSlots,
    draftCapacity: draftableSlots.reduce((total, slot) => total + slot.count, 0),
    rosterMaximums,
    unsupportedSlots,
  };
};

export const lineupFor = (rosterSlots: Readonly<Record<string, number>>): LineupSettings => {
  const importedLineup: LineupSettings = {};
  for (const [slot, count] of Object.entries(rosterSlots)) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new LeagueCreationError(`Roster slot ${slot} must be a non-negative whole number.`);
    }
    if (count > 0) importedLineup[slot] = count;
  }
  if (Object.keys(importedLineup).length === 0) {
    throw new LeagueCreationError("At least one roster slot is required.");
  }
  const analysis = analyzeRosterSlots(importedLineup);
  const unsupportedSlot = analysis.unsupportedSlots[0];
  if (unsupportedSlot !== undefined) {
    throw new LeagueCreationError(
      `Unsupported roster slot ${unsupportedSlot}. Review the roster settings before continuing.`,
    );
  }
  if (analysis.draftCapacity === 0) {
    throw new LeagueCreationError("At least one draftable roster slot is required.");
  }
  return analysis.draftableSlots.reduce<LineupSettings>((lineup, slot) => ({
    ...lineup,
    [slot.slot]: (lineup[slot.slot] ?? 0) + slot.count,
  }), {});
};
