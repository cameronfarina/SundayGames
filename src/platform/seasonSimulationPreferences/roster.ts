import type { ResolvedSeasonSimulationPreference } from "./contracts.js";

const qualifyingIdsFor = (
  preference: ResolvedSeasonSimulationPreference,
): ReadonlySet<string> => new Set(preference.rule.qualifyingPlayerIds);

export const preferenceRosterCountFor = (
  roster: readonly { playerId: string }[],
  preference: ResolvedSeasonSimulationPreference,
  pairPlayerId: string | undefined,
): number => {
  const qualifyingIds = qualifyingIdsFor(preference);
  return roster.filter(player => player.playerId !== pairPlayerId && qualifyingIds.has(player.playerId)).length;
};

export const activePositionPreferenceFor = (
  preferences: readonly ResolvedSeasonSimulationPreference[],
  roster: readonly { playerId: string }[],
  player: { id: string; position: string },
  pairPlayerId: string | undefined,
): ResolvedSeasonSimulationPreference | undefined => preferences.find(preference =>
  preference.preference.position === player.position
  && qualifyingIdsFor(preference).has(player.id)
  && preferenceRosterCountFor(roster, preference, pairPlayerId) < preference.targetCount
);
