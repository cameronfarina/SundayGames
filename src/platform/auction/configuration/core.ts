import type { GenericAuctionMockConfig } from "../types.js";
import { GenericAuctionMockError } from "../errors.js";
import { isNonBlank } from "./values.js";

export const assertCoreConfiguration = (config: GenericAuctionMockConfig): void => {
  if (!isNonBlank(config.sessionId) || !isNonBlank(config.seed)) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Auction session id and seed are required.",
    );
  }

  if (config.teams.length < 4 || config.teams.length > 20) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Auction mocks require between 4 and 20 teams.",
    );
  }

  const teamIds = config.teams.map(team => team.id);
  const hasInvalidTeam = config.teams.some(team => (
    !isNonBlank(team.id) || !isNonBlank(team.name)
  ));
  if (new Set(teamIds).size !== teamIds.length || hasInvalidTeam) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Every auction team needs a unique non-blank id and a non-blank name.",
    );
  }

  if (!teamIds.includes(config.humanTeamId)) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Human team id must identify a configured team.",
    );
  }

  const invalidBudget = !Number.isInteger(config.budgetDollars)
    || config.budgetDollars <= 0
    || !Number.isInteger(config.minimumBidDollars)
    || config.minimumBidDollars <= 0;
  if (invalidBudget) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Auction budget and minimum bid must be positive whole-dollar amounts.",
    );
  }
};
