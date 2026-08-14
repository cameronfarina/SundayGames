import type { Player } from "../../types.js";
import { AuctionOwnerState, AuctionSale, AuctionSalePriceBasis, ResolveAuctionSaleOptions } from "./auctionContracts.js";
import { bidForOwner } from "./bidCalculation.js";
import { ownerCanBidOnPlayer } from "./bidEligibility.js";
import { bidDiagnosticsFor, compareBids } from "./bidOrdering.js";
import { AuctionEngineConfig } from "./configContracts.js";
import { defaultAuctionEngineConfig } from "./defaultConfig.js";
import { scarcityMultiplierFor } from "./demand.js";
import { budgetFlushBidFor, lateOpeningBidForNominator } from "./pressure.js";
import { roomPressureDiagnosticsFor, salePriceBasisFor, tierSaleGuardPriceFor, topEndSaleGuardPriceFor } from "./saleDiagnostics.js";

export const resolveAuctionSale = (
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig = defaultAuctionEngineConfig,
  options: ResolveAuctionSaleOptions = {},
): AuctionSale | undefined => {
  const diagnosticsMode = options.diagnosticsMode ?? "full";
  const scarcityMultiplier = scarcityMultiplierFor(player, ownerStates, remainingPlayers, config);
  const nominatorOpeningBid = lateOpeningBidForNominator(
    options.nominator,
    player,
    ownerStates,
    remainingPlayers,
    config,
  );
  const bids = ownerStates
    .filter(state => ownerCanBidOnPlayer(state, player, ownerStates, remainingPlayers, config))
    .map(state => bidForOwner(
      state,
      player,
      ownerStates,
      remainingPlayers,
      scarcityMultiplier,
      config,
      state.owner === options.nominator ? nominatorOpeningBid : 0,
    ))
    .filter(bid => bid.amount >= config.minimumBid)
    .sort(compareBids(config));

  const winningBid = bids[0];
  if (!winningBid) return undefined;

  const winningState = ownerStates.find(state => state.owner === winningBid.owner);
  const secondBidAmount = bids[1]?.amount ?? 0;
  const reservePrice = Math.max(config.minimumBid, Math.round(player.price * config.reservePriceRatio));
  const budgetFlushBid = winningState === undefined ? 0 : budgetFlushBidFor(winningState, player, remainingPlayers, config);
  const salePriceFloors = [
    { basis: "minimum_bid", amount: config.minimumBid },
    { basis: "second_bid_plus_minimum", amount: secondBidAmount + config.minimumBid },
    { basis: "reserve_price", amount: reservePrice },
    { basis: "nominator_opening_bid", amount: nominatorOpeningBid },
    { basis: "budget_flush", amount: budgetFlushBid },
  ] satisfies readonly { basis: AuctionSalePriceBasis; amount: number }[];
  const salePriceFloor = salePriceFloors.reduce<{ basis: AuctionSalePriceBasis; amount: number }>(
    (highest, candidate) => candidate.amount > highest.amount ? candidate : highest,
    { basis: "minimum_bid", amount: config.minimumBid },
  );
  const uncappedSalePrice = Math.min(winningBid.amount, salePriceFloor.amount);
  const topEndGuardedPrice = topEndSaleGuardPriceFor(player, uncappedSalePrice, config);
  const price = tierSaleGuardPriceFor(player, topEndGuardedPrice, config);

  return {
    player,
    winner: winningBid.owner,
    price,
    marketPrice: player.price,
    bids,
    diagnostics: {
      secondBidAmount,
      reservePrice,
      nominatorOpeningBid,
      uncappedSalePrice,
      topEndGuardedPrice,
      salePriceBasis: salePriceBasisFor(winningBid.amount, salePriceFloors),
      roomPressure: roomPressureDiagnosticsFor({
        bids,
        ownerStates,
        reservePrice,
        anchorPrice: player.price,
        salePrice: price,
        winningBid,
        config,
      }),
      topBids: diagnosticsMode === "full" ? bids.slice(0, 3).map(bidDiagnosticsFor) : [],
    },
  };
};
