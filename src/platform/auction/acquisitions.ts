import { setBoardPlayerStatus } from "./board.js";
import { GenericAuctionMockError } from "./errors.js";
import {
  assertCanAcquire,
  maxBidFor,
  playerFor,
  teamFor,
} from "./roster.js";
import {
  hasStarterEligibilitySignalFor,
  isStarterEligible,
} from "./starterEligibility.js";
import type {
  GenericAuctionMockBoardPlayer,
  GenericAuctionMockRosterPlayer,
  GenericAuctionMockSale,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "./types.js";

export const addAcquisition = ({
  state,
  player,
  team,
  price,
  source,
  nominatedByTeam,
  nominationNumber,
}: {
  state: GenericAuctionMockState;
  player: GenericAuctionMockBoardPlayer;
  team: GenericAuctionMockTeamReadModel;
  price: number;
  source: GenericAuctionMockSale["source"];
  nominatedByTeam: GenericAuctionMockTeamReadModel;
  nominationNumber: number;
}): GenericAuctionMockState => {
  if (player.status === "sold") {
    throw new GenericAuctionMockError("duplicate_player", `${player.name} is already unavailable.`);
  }
  const preferFlexibleSlot = source === "keeper"
    && hasStarterEligibilitySignalFor(state, player.position)
    && !isStarterEligible(player);
  const slot = assertCanAcquire(state, team, player, price, preferFlexibleSlot);
  const rosterPlayer: GenericAuctionMockRosterPlayer = {
    playerId: player.id,
    playerName: player.name,
    position: player.position,
    expectedPrice: player.expectedPrice,
    price,
    source,
    rosterSlot: slot.slot,
  };
  const roster = [...team.roster, rosterPlayer];
  const spent = team.spent + price;
  const rosterSlotsRemaining = team.rosterSlotsRemaining - 1;
  const positionCounts = {
    ...team.positionCounts,
    [player.position]: (team.positionCounts[player.position] ?? 0) + 1,
  };
  const nextTeam: GenericAuctionMockTeamReadModel = {
    ...team,
    spent,
    budgetRemaining: team.budgetDollars - spent,
    rosterSlotsRemaining,
    maxBid: maxBidFor(
      team.budgetDollars - spent,
      rosterSlotsRemaining,
      state.configuration.minimumBidDollars,
    ),
    positionCounts,
    roster,
    slots: team.slots.map(candidate => candidate.slot === slot.slot
      ? { ...candidate, playerId: player.id }
      : candidate),
  };
  const sale: GenericAuctionMockSale = {
    number: state.sales.length + 1,
    nominationNumber,
    playerId: player.id,
    playerName: player.name,
    position: player.position,
    expectedPrice: player.expectedPrice,
    teamId: team.id,
    teamName: team.name,
    nominatedByTeamId: nominatedByTeam.id,
    nominatedByTeamName: nominatedByTeam.name,
    price,
    source,
  };

  return {
    ...state,
    board: setBoardPlayerStatus(state, player.id, "sold"),
    teams: state.teams.map(candidate => candidate.id === team.id ? nextTeam : candidate),
    sales: [...state.sales, sale],
  };
};

export const applyKeepers = (state: GenericAuctionMockState): GenericAuctionMockState => {
  let nextState = state;

  for (const keeper of state.configuration.keepers ?? []) {
    if (!Number.isInteger(keeper.price) || keeper.price < state.configuration.minimumBidDollars) {
      throw new GenericAuctionMockError(
        "invalid_keeper",
        `Keeper prices must be at least $${state.configuration.minimumBidDollars} in whole dollars.`,
      );
    }

    const team = teamFor(nextState, keeper.teamId);
    const player = playerFor(nextState, keeper.playerId);
    nextState = addAcquisition({
      state: nextState,
      player,
      team,
      price: keeper.price,
      source: "keeper",
      nominatedByTeam: team,
      nominationNumber: 0,
    });
  }

  return nextState;
};

export const applyPlannedAcquisitions = (
  state: GenericAuctionMockState,
): GenericAuctionMockState => {
  let nextState = state;

  for (const acquisition of state.configuration.plannedAcquisitions ?? []) {
    const team = teamFor(nextState, acquisition.teamId);
    const player = playerFor(nextState, acquisition.playerId);
    nextState = addAcquisition({
      state: nextState,
      player,
      team,
      price: acquisition.price,
      source: "human",
      nominatedByTeam: team,
      nominationNumber: 0,
    });
  }

  return nextState;
};
