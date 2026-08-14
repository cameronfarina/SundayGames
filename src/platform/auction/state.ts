import { auctionCatalogCanFillOpenRosters } from "../auctionCatalogFeasibility.js";
import {
  applyKeepers,
  applyPlannedAcquisitions,
} from "./acquisitions.js";
import { assertConfiguration } from "./configuration.js";
import { GenericAuctionMockError } from "./errors.js";
import {
  buildRosterSlots,
  emptyPositionCounts,
  maxBidFor,
  rosterCapacityFor,
} from "./roster.js";
import type {
  GenericAuctionMockConfig,
  GenericAuctionMockState,
} from "./types.js";

export const createGenericAuctionMockState = (
  config: GenericAuctionMockConfig,
): GenericAuctionMockState => {
  assertConfiguration(config);
  const rosterCapacity = rosterCapacityFor(config);
  const preparedState = applyPlannedAcquisitions(applyKeepers({
    configuration: config,
    nextNominatorIndex: 0,
    decisionHistory: [],
    session: {
      id: config.sessionId,
      status: "setup",
      phase: "not_started",
      revision: 0,
      seed: config.seed,
      humanTeamId: config.humanTeamId,
      nextNominatorTeamId: undefined,
      currentNomination: undefined,
      nominationsCompleted: 0,
      canUndo: false,
      canComplete: false,
      commandLog: [],
    },
    board: {
      players: config.players.map(player => ({
        ...player,
        status: "available",
        available: true,
      })),
    },
    teams: config.teams.map(team => ({
      id: team.id,
      name: team.name,
      isHuman: team.id === config.humanTeamId,
      budgetDollars: config.budgetDollars,
      spent: 0,
      budgetRemaining: config.budgetDollars,
      rosterSlotsRemaining: rosterCapacity,
      maxBid: maxBidFor(config.budgetDollars, rosterCapacity, config.minimumBidDollars),
      positionCounts: emptyPositionCounts(config),
      roster: [],
      slots: buildRosterSlots(config),
    })),
    sales: [],
    auctionEvents: [],
  }));

  if (!auctionCatalogCanFillOpenRosters({
    players: preparedState.board.players,
    teams: preparedState.teams,
    positionMaximums: config.positionMaximums,
  })) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "The player catalog cannot fill every team's remaining roster slots.",
    );
  }

  return preparedState;
};
