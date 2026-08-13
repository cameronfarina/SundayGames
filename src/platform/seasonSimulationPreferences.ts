import { canonicalPlayerIdentityKey } from "../data/normalizePlayerName.js";
import type { LeagueSeason, LeagueSeasonSettings } from "./leagueSeason.js";
import type { LiveDraftRoomSetup } from "./liveDraftRoomSetups.js";

export interface SeasonSimulationPreferredPosition {
  position: "QB" | "RB" | "WR" | "TE";
  tier: "elite";
  targetCount?: number | undefined;
  maxAuctionPrice?: number | undefined;
}

export interface SeasonSimulationPreferenceRule {
  basis: "auction_expected_value" | "snake_catalog_rank";
  positionRankMaximum: number;
  qualifyingPlayerIds: readonly string[];
  minimumExpectedValue?: number | undefined;
}

export interface SeasonSimulationPreferenceOutcome {
  position: SeasonSimulationPreferredPosition["position"];
  tier: SeasonSimulationPreferredPosition["tier"];
  targetCount: number;
  status: "hit" | "miss" | "infeasible";
  feasible: boolean;
  hitCount: number;
  hitRate: number;
  rule: SeasonSimulationPreferenceRule;
  message: string;
}

export interface ResolvedSeasonSimulationPreference {
  preference: SeasonSimulationPreferredPosition;
  targetCount: number;
  rule: SeasonSimulationPreferenceRule;
  feasible: boolean;
}

const teamsPerElitePlayer = 4;

const qualifyingIdsFor = (
  preference: ResolvedSeasonSimulationPreference,
): ReadonlySet<string> => new Set(preference.rule.qualifyingPlayerIds);

export const preferenceRosterCountFor = (
  roster: readonly { playerId: string }[],
  preference: ResolvedSeasonSimulationPreference,
  pairPlayerId: string | undefined,
): number => {
  const qualifyingIds = qualifyingIdsFor(preference);
  return roster.filter(player =>
    player.playerId !== pairPlayerId && qualifyingIds.has(player.playerId)
  ).length;
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

export const resolveSeasonSimulationPreferences = (input: {
  preferences: readonly SeasonSimulationPreferredPosition[];
  season: LeagueSeason<LeagueSeasonSettings>;
  setup: LiveDraftRoomSetup;
  humanTeamId: string;
  pairPlayerId: string | undefined;
  playerExpectedPrices?: Readonly<Record<string, number>> | undefined;
}): {
  preferences: readonly ResolvedSeasonSimulationPreference[];
  warnings: readonly string[];
} => {
  const positionRankMaximum = Math.max(
    1,
    Math.ceil(input.season.teams.length / teamsPerElitePlayer),
  );
  const initialRosterByPlayerId = new Map(input.setup.initialRosters.map(player => [
    player.playerId ?? canonicalPlayerIdentityKey(player.playerName),
    player,
  ]));
  const humanKeepers = input.setup.initialRosters.filter(player => player.teamId === input.humanTeamId);
  const openRosterSlots = Math.max(
    0,
    input.season.settings.roster.rosterSize - humanKeepers.length,
  );
  const humanPositionCounts = humanKeepers.reduce<Record<string, number>>((counts, player) => {
    counts[player.position] = (counts[player.position] ?? 0) + 1;
    return counts;
  }, {});
  const auctionBudgetRemaining = input.season.settings.draftFormat === "auction"
    ? input.season.settings.auction.budgetDollars
      - humanKeepers.reduce((total, player) => total + player.price, 0)
    : undefined;
  const minimumBid = input.season.settings.draftFormat === "auction"
    ? input.season.settings.auction.minimumBidDollars
    : undefined;
  const warnings: string[] = [];

  const preferences = input.preferences.map(preference => {
    const rankedPlayers = input.setup.playerCatalog
      .map((player, catalogIndex) => {
        const playerId = canonicalPlayerIdentityKey(player.name);
        return {
          playerId,
          position: player.position,
          expectedValue: input.playerExpectedPrices?.[playerId] ?? player.expectedPrice,
          catalogIndex,
        };
      })
      .filter(player => player.position === preference.position)
      .sort((left, right) => input.season.settings.draftFormat === "auction"
        ? right.expectedValue - left.expectedValue || left.playerId.localeCompare(right.playerId)
        : left.catalogIndex - right.catalogIndex || left.playerId.localeCompare(right.playerId));
    const qualifyingPlayers = rankedPlayers.slice(0, positionRankMaximum);
    const qualifyingPlayerIds = qualifyingPlayers.map(player => player.playerId);
    const rule: SeasonSimulationPreferenceRule = {
      basis: input.season.settings.draftFormat === "auction"
        ? "auction_expected_value"
        : "snake_catalog_rank",
      positionRankMaximum,
      qualifyingPlayerIds,
      ...(input.season.settings.draftFormat !== "auction" || qualifyingPlayers.length === 0
        ? {}
        : { minimumExpectedValue: qualifyingPlayers.at(-1)?.expectedValue }),
    };
    const targetCount = preference.targetCount ?? 1;
    const qualifyingIds = new Set(qualifyingPlayerIds);
    const ownedCount = humanKeepers.filter(player => {
      const playerId = player.playerId ?? canonicalPlayerIdentityKey(player.playerName);
      return playerId !== input.pairPlayerId && qualifyingIds.has(playerId);
    }).length;
    const neededCount = Math.max(0, targetCount - ownedCount);
    const positionCapacity = Math.max(
      0,
      (input.season.settings.roster.rosterMaximums[preference.position] ?? 0)
        - (humanPositionCounts[preference.position] ?? 0),
    );
    const availableQualifiers = qualifyingPlayers.filter(player => {
      if (player.playerId === input.pairPlayerId) return false;
      const keeper = initialRosterByPlayerId.get(player.playerId);
      if (keeper !== undefined && keeper.teamId !== input.humanTeamId) return false;
      return input.season.settings.draftFormat !== "auction"
        || preference.maxAuctionPrice === undefined
        || player.expectedValue <= preference.maxAuctionPrice;
    });
    const structurallyFeasible = neededCount <= availableQualifiers.length
      && neededCount <= positionCapacity
      && neededCount <= openRosterSlots;
    const budgetFeasible = input.season.settings.draftFormat !== "auction"
      || neededCount === 0
      || (
        auctionBudgetRemaining !== undefined
        && minimumBid !== undefined
        && availableQualifiers
          .slice()
          .sort((left, right) => left.expectedValue - right.expectedValue)
          .slice(0, neededCount)
          .reduce((total, player) => total + player.expectedValue, 0)
          <= auctionBudgetRemaining - Math.max(0, openRosterSlots - neededCount) * minimumBid
      );
    const feasible = structurallyFeasible && budgetFeasible;
    if (!feasible) {
      const cap = preference.maxAuctionPrice === undefined
        ? ""
        : ` and $${preference.maxAuctionPrice} cap`;
      warnings.push(
        `Elite ${preference.position} preference is infeasible: the league-relative tier${cap} cannot supply ${targetCount} player${targetCount === 1 ? "" : "s"}.`,
      );
    }

    return { preference, targetCount, rule, feasible };
  });

  return { preferences, warnings };
};
