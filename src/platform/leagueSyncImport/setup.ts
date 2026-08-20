import type { SyncedLeagueSettings } from "../../data/leagueSyncProviderAdapters.js";
import type { ConfirmedLeagueCreationInput } from "../leagueCreation.js";
import { analyzeRosterSlots } from "../leagueCreation.js";
import type { ScoringSettings } from "../leagueSeason.js";
import type { LeagueConnection, StoredLeagueSnapshot } from "../leagueConnections.js";

export type SyncedLeagueSetupResult =
  | { status: "ready"; setup: ConfirmedLeagueCreationInput }
  | { status: "needs_attention"; message: string };

const finiteScore = (
  settings: SyncedLeagueSettings,
  key: string,
): number | null => {
  const value = settings.scoring[key];
  return value === undefined || !Number.isFinite(value) ? null : value;
};

const scoringFor = (settings: SyncedLeagueSettings): ScoringSettings | null => {
  const passingYards = finiteScore(settings, "pass_yd");
  const passingTouchdown = finiteScore(settings, "pass_td");
  const rushingYards = finiteScore(settings, "rush_yd");
  const rushingTouchdown = finiteScore(settings, "rush_td");
  const receivingYards = finiteScore(settings, "rec_yd");
  const receivingTouchdown = finiteScore(settings, "rec_td");
  const reception = finiteScore(settings, "rec");
  if (
    passingYards === null || passingTouchdown === null ||
    rushingYards === null || rushingTouchdown === null ||
    receivingYards === null || receivingTouchdown === null || reception === null
  ) return null;
  return {
    passingYards,
    passingTouchdown,
    rushingYards,
    rushingTouchdown,
    receivingYards,
    receivingTouchdown,
    reception,
  };
};

const canonicalSourceSlot = (slot: string): string => {
  const normalized = slot.trim().toUpperCase();
  if (normalized === "BN") return "BENCH";
  if (normalized === "DEF" || normalized === "D/ST") return "DST";
  return normalized;
};

const rosterSlotsFor = (settings: SyncedLeagueSettings): Readonly<Record<string, number>> =>
  settings.rosterPositions.reduce<Record<string, number>>((slots, rawSlot) => {
    const slot = canonicalSourceSlot(rawSlot);
    slots[slot] = (slots[slot] ?? 0) + 1;
    return slots;
  }, {});

const invalidSeason = (season: string): boolean => {
  const parsed = Number(season);
  return !Number.isSafeInteger(parsed) || parsed < 2000 || parsed > 2100;
};

export const confirmedSetupFromSyncedLeague = (
  connection: LeagueConnection,
  snapshot: StoredLeagueSnapshot,
): SyncedLeagueSetupResult => {
  const settings = snapshot.settings;
  if (invalidSeason(settings.season)) {
    return { status: "needs_attention", message: "The provider did not return a valid league season." };
  }
  if (snapshot.teams.length !== settings.teamCount || settings.teamCount < 2) {
    return { status: "needs_attention", message: "The provider team list does not match the league team count." };
  }
  if (settings.draft === undefined) {
    return { status: "needs_attention", message: "Confirm this league's draft type and draft settings before importing it." };
  }
  if (settings.keeperLeague === undefined) {
    return { status: "needs_attention", message: "Confirm whether this is a keeper league before importing it." };
  }
  const scoring = scoringFor(settings);
  if (scoring === null) {
    return { status: "needs_attention", message: "The provider did not return every scoring setting Sunday Games needs." };
  }
  const rosterSlots = rosterSlotsFor(settings);
  const rosterAnalysis = analyzeRosterSlots(rosterSlots);
  if (rosterAnalysis.unsupportedSlots.length > 0 || rosterAnalysis.draftCapacity === 0) {
    return {
      status: "needs_attention",
      message: `Review the imported roster slots: ${rosterAnalysis.unsupportedSlots.join(", ") || "no draftable slots"}.`,
    };
  }
  const teamIds = new Set(snapshot.teams.map(team => team.providerTeamId));
  if (settings.draft.type === "snake" && settings.draft.order.some(id => !teamIds.has(id))) {
    return { status: "needs_attention", message: "The provider draft order does not match the imported teams." };
  }

  return {
    status: "ready",
    setup: {
      provider: connection.provider,
      externalLeagueId: connection.providerLeagueId,
      leagueName: settings.name,
      seasonYear: Number(settings.season),
      expectedTeamCount: settings.teamCount,
      keeperLeague: settings.keeperLeague,
      teams: snapshot.teams.map(team => ({
        externalTeamId: team.providerTeamId,
        displayName: team.name,
        managerNames: team.ownerNames,
      })),
      draft: settings.draft,
      scoring,
      rosterSlots,
    },
  };
};
