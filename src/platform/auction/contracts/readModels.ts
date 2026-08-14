import type { GenericAuctionMockCommand } from "./commands.js";
import type { GenericAuctionMockPlayer } from "./config.js";

export type GenericAuctionMockStatus = "setup" | "active" | "completed";
export type GenericAuctionMockPhase =
  | "not_started"
  | "awaiting_human_nomination"
  | "awaiting_human_bid"
  | "ready_to_complete"
  | "completed";
export type GenericAuctionMockPlayerStatus = "available" | "nominated" | "sold";

export interface GenericAuctionMockBoardPlayer extends GenericAuctionMockPlayer {
  status: GenericAuctionMockPlayerStatus;
  available: boolean;
}

export interface GenericAuctionMockRosterPlayer {
  playerId: string;
  playerName: string;
  position: string;
  expectedPrice: number;
  price: number;
  source: "keeper" | "human" | "ai";
  rosterSlot: string;
}

export interface GenericAuctionMockRosterSlot {
  slot: string;
  eligiblePositions: readonly string[];
  playerId: string | undefined;
}

export interface GenericAuctionMockTeamReadModel {
  id: string;
  name: string;
  isHuman: boolean;
  budgetDollars: number;
  spent: number;
  budgetRemaining: number;
  rosterSlotsRemaining: number;
  maxBid: number;
  positionCounts: Readonly<Record<string, number>>;
  roster: readonly GenericAuctionMockRosterPlayer[];
  slots: readonly GenericAuctionMockRosterSlot[];
}

export interface GenericAuctionMockSale {
  number: number;
  nominationNumber: number;
  playerId: string;
  playerName: string;
  position: string;
  expectedPrice: number;
  teamId: string;
  teamName: string;
  nominatedByTeamId: string;
  nominatedByTeamName: string;
  price: number;
  source: "keeper" | "human" | "ai";
}

export type GenericAuctionMockEventType = "nomination" | "bid" | "countdown" | "sold";

export interface GenericAuctionMockEvent {
  sequence: number;
  nominationNumber: number;
  type: GenericAuctionMockEventType;
  playerId: string;
  playerName: string;
  teamId?: string | undefined;
  teamName?: string | undefined;
  price?: number | undefined;
  countdown?: number | undefined;
  text: string;
}

export interface GenericAuctionMockNomination {
  number: number;
  playerId: string;
  playerName: string;
  position: string;
  expectedPrice: number;
  nominatedByTeamId: string;
  nominatedByTeamName: string;
  highestBidderTeamId: string;
  highestBidderTeamName: string;
  currentPrice: number;
  nextBid: number;
  humanCanBuy: boolean;
  humanCanPass: boolean;
  humanPassed: boolean;
}

export interface GenericAuctionMockSessionReadModel {
  id: string;
  status: GenericAuctionMockStatus;
  phase: GenericAuctionMockPhase;
  revision: number;
  seed: string;
  humanTeamId: string;
  nextNominatorTeamId: string | undefined;
  currentNomination: GenericAuctionMockNomination | undefined;
  nominationsCompleted: number;
  canUndo: boolean;
  canComplete: boolean;
  commandLog: readonly GenericAuctionMockCommand[];
}

export interface GenericAuctionMockBoardReadModel {
  players: readonly GenericAuctionMockBoardPlayer[];
}
