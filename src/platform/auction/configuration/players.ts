import type { GenericAuctionMockConfig, GenericAuctionMockPlayer } from "../types.js";
import { GenericAuctionMockError } from "../errors.js";
import { isNonBlank, isNonNegativeFinite } from "./values.js";

const hasInvalidProjection = (player: GenericAuctionMockPlayer): boolean => (
  (player.humanValue !== undefined && !isNonNegativeFinite(player.humanValue))
  || (player.week1Projection !== undefined && !isNonNegativeFinite(player.week1Projection))
  || (player.weeks1To4Projection !== undefined
    && !isNonNegativeFinite(player.weeks1To4Projection))
  || (player.seasonProjection !== undefined && !isNonNegativeFinite(player.seasonProjection))
);

const hasInvalidStarterFlag = (player: GenericAuctionMockPlayer): boolean => (
  (player.starterEligible !== undefined && typeof player.starterEligible !== "boolean")
  || (player.projectedStarter !== undefined && typeof player.projectedStarter !== "boolean")
);

const isInvalidPlayer = (player: GenericAuctionMockPlayer): boolean => (
  !isNonBlank(player.id)
  || !isNonBlank(player.name)
  || !isNonBlank(player.position)
  || !isNonNegativeFinite(player.expectedPrice)
  || hasInvalidProjection(player)
  || hasInvalidStarterFlag(player)
);

export const playerIdsFor = (config: GenericAuctionMockConfig): readonly string[] => (
  config.players.map(player => player.id)
);

export const assertPlayers = (config: GenericAuctionMockConfig): void => {
  const playerIds = playerIdsFor(config);
  if (new Set(playerIds).size !== playerIds.length || config.players.some(isInvalidPlayer)) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Every player needs a unique id, name, position, and non-negative expected price.",
    );
  }
};
