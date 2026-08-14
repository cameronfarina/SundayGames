import type { Position } from "../../../config/league.js";
import type { GenericAuctionMockRosterSlotConfig } from "../genericAuctionMockEngine.js";
import { analyzeRosterSlots } from "../leagueCreation.js";
import type { ExplicitLeagueSeason } from "../leagueSeason.js";
import type { LiveDraftRoomSetup } from "../liveDraftRoomSetups.js";
import { SeasonAuctionMockError } from "./errors.js";

const allPositions: readonly Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

export const rosterSlotsFor = (
  season: ExplicitLeagueSeason,
): readonly GenericAuctionMockRosterSlotConfig[] => {
  const analysis = analyzeRosterSlots(season.settings.roster.lineup);
  const unsupportedSlot = analysis.unsupportedSlots[0];
  if (unsupportedSlot !== undefined) {
    throw new SeasonAuctionMockError(
      "setup_mismatch",
      `Roster slot ${unsupportedSlot} is unsupported. Review the league roster settings before starting a mock.`,
    );
  }
  return analysis.draftableSlots;
};

export const positionMaximumsFor = (
  season: ExplicitLeagueSeason,
  setup: LiveDraftRoomSetup,
): Readonly<Record<string, number>> => {
  const derived = analyzeRosterSlots(season.settings.roster.lineup).rosterMaximums;
  const configured = season.settings.roster.rosterMaximums;
  const positions = new Set([...allPositions, ...setup.playerCatalog.map(player => player.position)]);
  return Object.fromEntries([...positions].map(position => {
    const maximum = configured[position];
    const derivedMaximum = derived[position];
    return [
      position,
      typeof maximum === "number" && Number.isInteger(maximum) && maximum >= 0
        ? Math.min(maximum, derivedMaximum)
        : derivedMaximum,
    ];
  }));
};
