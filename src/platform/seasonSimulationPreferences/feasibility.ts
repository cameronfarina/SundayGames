import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import type {
  RankedPreferencePlayer,
  ResolvedSeasonSimulationPreference,
  SeasonSimulationPreferenceContext,
  SeasonSimulationPreferredPosition,
} from "./contracts.js";
import type { RankedPreference } from "./ranking.js";

const availableQualifiersFor = (
  context: SeasonSimulationPreferenceContext,
  preference: SeasonSimulationPreferredPosition,
  qualifyingPlayers: readonly RankedPreferencePlayer[],
): readonly RankedPreferencePlayer[] => qualifyingPlayers.filter(player => {
  if (player.playerId === context.input.pairPlayerId) return false;
  const keeper = context.initialRosterByPlayerId.get(player.playerId);
  if (keeper !== undefined && keeper.teamId !== context.input.humanTeamId) return false;
  return context.input.season.settings.draftFormat !== "auction"
    || preference.maxAuctionPrice === undefined
    || player.expectedValue <= preference.maxAuctionPrice;
});

const budgetAllows = (
  context: SeasonSimulationPreferenceContext,
  neededCount: number,
  availableQualifiers: readonly RankedPreferencePlayer[],
): boolean => context.input.season.settings.draftFormat !== "auction"
  || neededCount === 0
  || (
    context.auctionBudgetRemaining !== undefined
    && context.minimumBid !== undefined
    && availableQualifiers
      .slice()
      .sort((left, right) => left.expectedValue - right.expectedValue)
      .slice(0, neededCount)
      .reduce((total, player) => total + player.expectedValue, 0)
      <= context.auctionBudgetRemaining
        - Math.max(0, context.openRosterSlots - neededCount) * context.minimumBid
  );

export const resolvePreference = (
  context: SeasonSimulationPreferenceContext,
  preference: SeasonSimulationPreferredPosition,
  ranked: RankedPreference,
): ResolvedSeasonSimulationPreference => {
  const targetCount = preference.targetCount ?? 1;
  const qualifyingIds = new Set(ranked.rule.qualifyingPlayerIds);
  const ownedCount = context.humanKeepers.filter(player => {
    const playerId = player.playerId ?? canonicalPlayerIdentityKey(player.playerName);
    return playerId !== context.input.pairPlayerId && qualifyingIds.has(playerId);
  }).length;
  const neededCount = Math.max(0, targetCount - ownedCount);
  const positionCapacity = Math.max(
    0,
    (context.input.season.settings.roster.rosterMaximums[preference.position] ?? 0)
      - (context.humanPositionCounts[preference.position] ?? 0),
  );
  const availableQualifiers = availableQualifiersFor(context, preference, ranked.qualifyingPlayers);
  const structurallyFeasible = neededCount <= availableQualifiers.length
    && neededCount <= positionCapacity
    && neededCount <= context.openRosterSlots;
  const feasible = structurallyFeasible && budgetAllows(context, neededCount, availableQualifiers);
  return { preference, targetCount, rule: ranked.rule, feasible };
};

export const infeasiblePreferenceWarning = (
  resolved: ResolvedSeasonSimulationPreference,
): string => {
  const cap = resolved.preference.maxAuctionPrice === undefined
    ? ""
    : ` and $${resolved.preference.maxAuctionPrice} cap`;
  const playerSuffix = resolved.targetCount === 1 ? "" : "s";
  return `Elite ${resolved.preference.position} preference is infeasible: the league-relative tier${cap} cannot supply ${resolved.targetCount} player${playerSuffix}.`;
};
