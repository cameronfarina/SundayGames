import type { ForcedAuctionSale } from "../../modeling/mockBatch.js";
import type { SimulationRequest } from "./runContracts.js";

export const forcedSalesForSimulationRequest = (
  request: SimulationRequest,
): readonly ForcedAuctionSale[] => request.strategy.hardLocks.flatMap(hardLock =>
  hardLock.auctionOwner === undefined
    ? []
    : [{ owner: hardLock.auctionOwner, player: hardLock.playerName, price: hardLock.price }],
);
