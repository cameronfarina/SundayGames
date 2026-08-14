import type { Owner } from "../../../config/league.js";
import type {
  AuctionBudgetTrajectoryEvent,
  AuctionBudgetTrajectoryRow,
  AuctionOwnerState,
  AuctionSale,
} from "./auctionContracts.js";
import { countPositions } from "./ownerStates.js";
import { budgetPerRosterSlotFor } from "./saleDiagnostics.js";

export const budgetTrajectoryRowsFor = (
  ownerStates: readonly AuctionOwnerState[],
  pick: number,
  event: AuctionBudgetTrajectoryEvent,
  initialSpendByOwner: ReadonlyMap<Owner, number>,
  saleContext?: {
    nominator: Owner;
    sale: AuctionSale;
  },
): AuctionBudgetTrajectoryRow[] =>
  ownerStates.map(state => {
    const initialSpend = initialSpendByOwner.get(state.owner) ?? 0;

    return {
      pick,
      event,
      owner: state.owner,
      ...(saleContext ? {
        nominator: saleContext.nominator,
        winningOwner: saleContext.sale.winner,
        player: saleContext.sale.player.name,
        position: saleContext.sale.player.position,
        marketPrice: saleContext.sale.marketPrice,
        salePrice: saleContext.sale.price,
      } : {}),
      spent: state.spent,
      initialSpend,
      auctionSpend: state.spent - initialSpend,
      budgetRemaining: state.budgetRemaining,
      rosterSlotsRemaining: state.rosterSlotsRemaining,
      maxBid: state.maxBid,
      rosterSize: state.roster.length,
      budgetPerRosterSlot: budgetPerRosterSlotFor(state),
      positionCounts: countPositions(state.roster),
    };
  });
