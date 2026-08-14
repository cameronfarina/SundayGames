import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import type {
  RankedPreferencePlayer,
  SeasonSimulationPreferenceContext,
  SeasonSimulationPreferenceRule,
  SeasonSimulationPreferredPosition,
} from "./contracts.js";

export interface RankedPreference {
  qualifyingPlayers: readonly RankedPreferencePlayer[];
  rule: SeasonSimulationPreferenceRule;
}

export const rankPreference = (
  context: SeasonSimulationPreferenceContext,
  preference: SeasonSimulationPreferredPosition,
): RankedPreference => {
  const format = context.input.season.settings.draftFormat;
  const rankedPlayers = context.input.setup.playerCatalog
    .map((player, catalogIndex): RankedPreferencePlayer => {
      const playerId = canonicalPlayerIdentityKey(player.name);
      return {
        playerId,
        position: player.position,
        expectedValue: context.input.playerExpectedPrices?.[playerId] ?? player.expectedPrice,
        catalogIndex,
      };
    })
    .filter(player => player.position === preference.position)
    .sort((left, right) => format === "auction"
      ? right.expectedValue - left.expectedValue || left.playerId.localeCompare(right.playerId)
      : left.catalogIndex - right.catalogIndex || left.playerId.localeCompare(right.playerId));
  const qualifyingPlayers = rankedPlayers.slice(0, context.positionRankMaximum);
  const qualifyingPlayerIds = qualifyingPlayers.map(player => player.playerId);
  const minimumExpectedValue = qualifyingPlayers.at(-1)?.expectedValue;
  return {
    qualifyingPlayers,
    rule: {
      basis: format === "auction" ? "auction_expected_value" : "snake_catalog_rank",
      positionRankMaximum: context.positionRankMaximum,
      qualifyingPlayerIds,
      ...(format !== "auction" || minimumExpectedValue === undefined ? {} : { minimumExpectedValue }),
    },
  };
};
