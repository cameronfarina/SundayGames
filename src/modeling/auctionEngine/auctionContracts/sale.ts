import type { Owner } from "../../../../config/league.js";
import type { Player } from "../../../types.js";
import type { AuctionDiagnosticsMode } from "../configContracts.js";
import type { AuctionBid, AuctionBidDiagnostics } from "./bidding.js";

export type AuctionSalePriceBasis =
  | "minimum_bid"
  | "second_bid_plus_minimum"
  | "reserve_price"
  | "nominator_opening_bid"
  | "budget_flush"
  | "winning_bid_cap";

export interface AuctionRoomPressureDiagnostics {
  legalBidderCount: number;
  biddersAtOrAboveReserve: number;
  biddersAtOrAboveAnchor: number;
  biddersAtOrAboveSalePrice: number;
  cashHeavyBidderCount: number;
  maxBidderMaxBid: number;
  medianBidderMaxBid: number;
  averageBidderMaxBid: number;
  winningOwnerMaxBid: number;
  winningOwnerBudgetRemainingBefore: number;
  winningOwnerBudgetPerRosterSlotBefore: number | null;
}

export interface AuctionPickDiagnostics {
  secondBidAmount: number;
  reservePrice: number;
  nominatorOpeningBid: number;
  uncappedSalePrice: number;
  topEndGuardedPrice: number;
  salePriceBasis: AuctionSalePriceBasis;
  roomPressure: AuctionRoomPressureDiagnostics;
  topBids: AuctionBidDiagnostics[];
}

export interface AuctionSale {
  player: Player;
  winner: Owner;
  price: number;
  marketPrice: number;
  bids: AuctionBid[];
  diagnostics: AuctionPickDiagnostics;
}

export interface ResolveAuctionSaleOptions {
  nominator?: Owner;
  diagnosticsMode?: AuctionDiagnosticsMode;
}
