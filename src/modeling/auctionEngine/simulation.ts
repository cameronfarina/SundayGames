import type { Player } from "../../types.js";
import type { AuctionPick, AuctionResult, AuctionRosters, SimulateAuctionOptions } from "./auctionContracts.js";
import { defaultAuctionEngineConfig } from "./defaultConfig.js";
import { selectNominatedPlayer } from "./nominationSelection.js";
import { compareAuctionPlayers, initialNominationCursorFor, nextNominationTurn } from "./nominationTypes.js";
import { createAuctionOwnerStates } from "./ownerStates.js";
import { resolveAuctionSale } from "./resolveSale.js";
import { budgetTrajectoryRowsFor } from "./simulationBudgetTrajectory.js";
import { allRostersFull, applySaleToState } from "./simulationOwnerState.js";

export { budgetTrajectoryRowsFor } from "./simulationBudgetTrajectory.js";
export { allRostersFull, applySaleToState } from "./simulationOwnerState.js";

export const simulateAuction = ({
  players,
  config = defaultAuctionEngineConfig,
  initialRostersByOwner = {},
  diagnosticsMode = "full",
}: SimulateAuctionOptions): AuctionResult => {
  let ownerStates = createAuctionOwnerStates({ config, initialRostersByOwner });
  const initialSpendByOwner = new Map(ownerStates.map(state => [state.owner, state.spent]));
  const availablePlayers = [...players].sort(compareAuctionPlayers);
  const passedPlayers: Player[] = [];
  const picks: AuctionPick[] = [];
  const budgetTrajectory = diagnosticsMode === "full"
    ? budgetTrajectoryRowsFor(ownerStates, 0, "initial", initialSpendByOwner)
    : [];
  let nominationCursor = initialNominationCursorFor(config);

  while (availablePlayers.length > 0 && !allRostersFull(ownerStates)) {
    const nominationTurn = nextNominationTurn(ownerStates, config, nominationCursor);
    const nominator = nominationTurn.owner;
    const nomination = selectNominatedPlayer({
      availablePlayers,
      ownerStates,
      nominator,
      pickIndex: picks.length,
      config,
      diagnosticsMode,
    });
    if (!nomination) break;

    const nominatedPlayers = availablePlayers.splice(nomination.index, 1);
    const nominatedPlayer = nominatedPlayers[0];
    if (!nominatedPlayer) throw new Error("Unable to remove nominated player from auction pool.");

    const sale = resolveAuctionSale(nominatedPlayer, ownerStates, availablePlayers, config, {
      nominator,
      diagnosticsMode,
    });
    nominationCursor = nominationTurn.nextCursor;
    if (!sale) {
      passedPlayers.push(nominatedPlayer);
      continue;
    }

    const soldPlayer = { ...nominatedPlayer, price: sale.price };
    const winnerState = ownerStates.find(state => state.owner === sale.winner);
    if (!winnerState) throw new Error(`Missing auction state for ${sale.winner}.`);

    const updatedWinnerState = applySaleToState(winnerState, soldPlayer, config);
    ownerStates = ownerStates.map(state => state.owner === sale.winner ? updatedWinnerState : state);
    const pickNumber = picks.length + 1;
    picks.push({
      pick: pickNumber,
      nominator,
      owner: sale.winner,
      player: soldPlayer.name,
      position: soldPlayer.position,
      marketPrice: sale.marketPrice,
      price: sale.price,
      budgetAfterPick: updatedWinnerState.budgetRemaining,
      rosterSlotsAfterPick: updatedWinnerState.rosterSlotsRemaining,
      topBids: diagnosticsMode === "full" ? sale.bids.slice(0, 3) : [],
      diagnostics: sale.diagnostics,
      nominationDiagnostics: nomination.diagnostics,
    });
    if (diagnosticsMode === "full") {
      budgetTrajectory.push(
        ...budgetTrajectoryRowsFor(ownerStates, pickNumber, "after_pick", initialSpendByOwner, { nominator, sale }),
      );
    }
  }

  const incompleteOwners = ownerStates
    .filter(state => state.rosterSlotsRemaining > 0)
    .map(state => `${state.owner} (${state.rosterSlotsRemaining})`);
  if (incompleteOwners.length > 0) {
    throw new Error(`Auction ended before all rosters were full: ${incompleteOwners.join(", ")}.`);
  }

  const soldNames = new Set(picks.map(pick => pick.player));
  const rosters: AuctionRosters = {};
  for (const state of ownerStates) {
    rosters[state.owner] = {
      strategy: `owner-local auction: ${config.seed}`,
      players: state.roster,
    };
  }

  return {
    seed: config.seed,
    rosters,
    ownerStates,
    picks,
    budgetTrajectory,
    unsoldPlayers: [...availablePlayers, ...passedPlayers]
      .filter(player => !soldNames.has(player.name))
      .sort(compareAuctionPlayers),
  };
};
