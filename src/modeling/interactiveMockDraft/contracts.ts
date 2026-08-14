import type { KeeperDeclaration } from "../../../config/keepers.js";
import type { Owner, Position } from "../../../config/league.js";
import type { DraftRoomRanking } from "../../data/draftRoomRankings.js";
import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import type { ProjectionRecord } from "../../projections.js";
import type { AuctionDiagnosticsMode } from "../auctionEngine.js";
import type { PricingConfig } from "../basePricing.js";
import type { KeeperScenario, KeeperScenarioKey } from "../keeperInflation.js";
import type {
  LiveDraftShortlistTarget,
  LiveDraftTarget,
} from "../liveDraft.js";
import type {
  LiveDraftStrategyDefinition,
  LiveDraftStrategyKey,
} from "../liveDraftStrategies.js";

export type InteractiveMockDraftPhase =
  | "ai-sale"
  | "human-decision"
  | "human-nomination"
  | "complete"
  | "blocked";

export type InteractiveMockDraftAction =
  | "advance"
  | "pass"
  | "cam-bid"
  | "cam-win"
  | "cam-nominate";

export interface InteractiveMockDraftNominationCandidate {
  rank: number;
  player: string;
  position: Position;
  marketPrice: number;
  score: number;
}

export interface InteractiveMockDraftNomination {
  player: string;
  position: Position;
  teamAbbreviation?: string;
  marketPrice: number;
  projectedWeeks1To4: number;
  topCandidates: InteractiveMockDraftNominationCandidate[];
}

export interface InteractiveMockDraftBid {
  owner: Owner;
  player: string;
  amount: number;
  maxBid: number;
  marketPrice: number;
}

export interface InteractiveMockDraftCamDecision {
  maxBid: number;
  recommendedBid: number;
  topAiBid: number;
  topAiBidOwner: Owner;
  aiSalePrice: number;
  valueGap: number;
}

export type InteractiveMockDraftAuctionEventType =
  | "nomination"
  | "bid"
  | "pass"
  | "countdown"
  | "sold";

export interface InteractiveMockDraftAuctionEvent {
  type: InteractiveMockDraftAuctionEventType;
  text: string;
  owner?: Owner;
  amount?: number;
  countdown?: number;
}

export type InteractiveMockDraftAuctionStatus =
  | "ai-sale"
  | "cam-decision"
  | "sold";

export interface InteractiveMockDraftAuctionResolution {
  owner: Owner;
  price: number;
  command: string;
}

export interface InteractiveMockDraftAuctionState {
  status: InteractiveMockDraftAuctionStatus;
  player: string;
  position: Position;
  nominator: Owner;
  openingBid: number;
  currentBid: number;
  currentBidOwner: Owner;
  nextCamBid?: number;
  camMaxBid?: number;
  feed: InteractiveMockDraftAuctionEvent[];
  resolution?: InteractiveMockDraftAuctionResolution;
}

export interface InteractiveMockDraftState {
  phase: InteractiveMockDraftPhase;
  watchOwner: Owner;
  strategy: LiveDraftStrategyDefinition;
  scenario: KeeperScenario;
  seed: string;
  pickNumber: number;
  commandCount: number;
  nominationCursor: number;
  nominator?: Owner;
  nomination?: InteractiveMockDraftNomination;
  aiBids: InteractiveMockDraftBid[];
  auction?: InteractiveMockDraftAuctionState;
  aiSaleCommand?: string;
  camDecision?: InteractiveMockDraftCamDecision;
  topTargets: LiveDraftTarget[];
  shortlist: LiveDraftShortlistTarget[];
  message?: string;
}

export type InteractiveMockDraftActionResult =
  | { command: string; mockDraft?: InteractiveMockDraftState }
  | { command?: undefined; mockDraft: InteractiveMockDraftState };

export interface BuildInteractiveMockDraftStateOptions {
  projections: readonly ProjectionRecord[];
  historicalRecords: readonly HistoricalAuctionRecord[];
  keepers?: readonly KeeperDeclaration[];
  scenarioKey?: KeeperScenarioKey;
  strategyKey?: LiveDraftStrategyKey;
  watchOwner?: Owner;
  commands?: readonly string[];
  pricingConfig?: PricingConfig;
  seed?: string;
  nominatedPlayer?: string;
  nominatedPrice?: number;
  draftRoomRankings?: readonly DraftRoomRanking[];
  diagnosticsMode?: AuctionDiagnosticsMode;
}
