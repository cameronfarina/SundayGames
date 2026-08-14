export type GenericAuctionMockStatus = "setup" | "active" | "completed";

export type GenericAuctionMockPhase =
  | "not_started"
  | "awaiting_human_nomination"
  | "awaiting_human_bid"
  | "ready_to_complete"
  | "completed";

export interface GenericAuctionMockAiTendency {
  bidMultiplier?: number | undefined;
  positionBidMultipliers?: Readonly<Record<string, number>> | undefined;
  nominationPositionWeights?: Readonly<Record<string, number>> | undefined;
  randomness?: number | undefined;
}

export interface GenericAuctionMockTeamConfig {
  id: string;
  name: string;
  aiTendency?: GenericAuctionMockAiTendency | undefined;
}

export interface GenericAuctionMockRosterSlotConfig {
  slot: string;
  count: number;
  eligiblePositions: readonly string[];
}

export interface GenericAuctionMockPlayer {
  id: string;
  name: string;
  position: string;
  expectedPrice: number;
  humanValue?: number | undefined;
  teamAbbreviation?: string | undefined;
  byeWeek?: number | undefined;
  week1Projection?: number | undefined;
  weeks1To4Projection?: number | undefined;
  seasonProjection?: number | undefined;
  starterEligible?: boolean | undefined;
  projectedStarter?: boolean | undefined;
}

export interface GenericAuctionMockKeeper {
  teamId: string;
  playerId: string;
  price: number;
}

export interface GenericAuctionMockPlannedAcquisition {
  teamId: string;
  playerId: string;
  price: number;
}

export interface GenericAuctionMockAiConfig {
  defaultBidMultiplier?: number | undefined;
  rosterNeedDollars?: number | undefined;
  randomness?: number | undefined;
  spendPacingExcludedPlayerIds?: readonly string[] | undefined;
  targetEndingBudgetDollars?: number | undefined;
}

export interface GenericAuctionMockConfig {
  sessionId: string;
  seed: string;
  humanTeamId: string;
  budgetDollars: number;
  minimumBidDollars: number;
  teams: readonly GenericAuctionMockTeamConfig[];
  rosterSlots: readonly GenericAuctionMockRosterSlotConfig[];
  positionMaximums: Readonly<Record<string, number>>;
  players: readonly GenericAuctionMockPlayer[];
  keepers?: readonly GenericAuctionMockKeeper[] | undefined;
  plannedAcquisitions?: readonly GenericAuctionMockPlannedAcquisition[] | undefined;
  ai?: GenericAuctionMockAiConfig | undefined;
}

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

export type GenericAuctionMockCommand =
  | {
    type: "start";
    expectedRevision: number;
  }
  | {
    type: "nominate";
    expectedRevision: number;
    playerId: string;
    openingBid?: number | undefined;
  }
  | {
    type: "buy";
    expectedRevision: number;
    price: number;
  }
  | {
    type: "pass";
    expectedRevision: number;
  }
  | {
    type: "undo";
    expectedRevision: number;
  }
  | {
    type: "complete";
    expectedRevision: number;
  };

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

export interface GenericAuctionMockSnapshot {
  session: Pick<
    GenericAuctionMockSessionReadModel,
    | "status"
    | "phase"
    | "nextNominatorTeamId"
    | "currentNomination"
    | "nominationsCompleted"
    | "canComplete"
  > & { nextNominatorIndex: number };
  board: GenericAuctionMockBoardReadModel;
  teams: readonly GenericAuctionMockTeamReadModel[];
  sales: readonly GenericAuctionMockSale[];
  auctionEvents: readonly GenericAuctionMockEvent[];
}

export interface GenericAuctionMockState {
  readonly configuration: GenericAuctionMockConfig;
  session: GenericAuctionMockSessionReadModel;
  board: GenericAuctionMockBoardReadModel;
  teams: readonly GenericAuctionMockTeamReadModel[];
  sales: readonly GenericAuctionMockSale[];
  auctionEvents: readonly GenericAuctionMockEvent[];
  readonly decisionHistory: readonly GenericAuctionMockSnapshot[];
  readonly nextNominatorIndex: number;
}
