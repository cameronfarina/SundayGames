import type { LeagueSyncProvider } from "../../data/leagueSyncProviderAdapters.js";
import { analyzeRosterSlots, normalizedRosterSlotKey } from "../leagueCreation.js";
import { providerLabelFor } from "./contracts.js";

export interface ImportedRosterSlots {
  issues: readonly string[];
  rosterSlots: Readonly<Record<string, number>>;
  /** Draftable slots per team: the snake round and auction reserve baseline. */
  draftCapacity: number;
}

/**
 * Provider spellings for slots Sunday Games already has. Everything else has to
 * match the creation vocabulary on its own, so a league with a slot this app
 * cannot fill is stopped rather than silently reshaped.
 */
const slotAliases: Readonly<Record<string, string>> = {
  BN: "BENCH",
  DEF: "DST",
  REC_FLEX: "WR_TE",
};

/** A taxi squad is never drafted and holds no starters, so it is left behind. */
const droppedSlots: ReadonlySet<string> = new Set(["TAXI"]);

export const importedRosterSlots = (
  rosterPositions: readonly string[],
  provider: LeagueSyncProvider,
): ImportedRosterSlots => {
  const rosterSlots: Record<string, number> = {};
  for (const position of rosterPositions) {
    const key = normalizedRosterSlotKey(position);
    if (key.length === 0 || droppedSlots.has(key)) continue;
    const slot = slotAliases[key] ?? key;
    rosterSlots[slot] = (rosterSlots[slot] ?? 0) + 1;
  }

  const analysis = analyzeRosterSlots(rosterSlots);
  const label = providerLabelFor(provider);
  const issues = analysis.unsupportedSlots.map(slot =>
    `${label} roster slot ${slot} is not supported.`);

  return { issues, rosterSlots, draftCapacity: analysis.draftCapacity };
};
