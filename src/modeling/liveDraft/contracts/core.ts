import type { KeeperScenario, KeeperScenarioKey } from "../../keeperInflation.js";
import type {
  LiveDraftStrategyDefinition,
  LiveDraftStrategyKey,
} from "../../liveDraftStrategies.js";
import type { Owner, Position } from "../../../../config/league.js";
import type {
  LiveDraftKeeperTarget,
  LiveDraftPathRecommendation,
  LiveDraftPositionContext,
  LiveDraftShortlistTarget,
  LiveDraftTarget,
} from "./targets.js";
import type { LiveDraftReadiness } from "./readiness.js";
import type { LiveDraftPlayerSource } from "./playerSource.js";

export type { LiveDraftPlayerSource };

export interface ParsedLiveDraftSaleCommand {
  ownerText: string;
  playerText: string;
  price: number;
}

export interface LiveDraftEvent {
  input: string;
  owner: Owner;
  player: string;
  normalizedPlayerName: string;
  position: Position;
  price: number;
  expectedPrice: number;
  saleVsExpected: number;
  playerSource: LiveDraftPlayerSource;
}

export interface LiveDraftSaleMockRange {
  draftedRate: number;
  averageSalePrice: number;
  minimumSalePrice: number;
  maximumSalePrice: number;
}

export type LiveDraftSaleAuditVerdict = "deal" | "fair" | "overpay";

export interface LiveDraftSaleAudit {
  input: string;
  owner: Owner;
  player: string;
  normalizedPlayerName: string;
  position: Position;
  price: number;
  expectedPrice: number;
  liveExpectedPrice: number;
  personalValue: number;
  expectedDelta: number;
  liveDelta: number;
  personalDelta: number;
  verdict: LiveDraftSaleAuditVerdict;
  mockRange?: LiveDraftSaleMockRange;
}

export interface LiveDraftCommandError {
  input: string;
  message: string;
}

export interface LiveDraftRosterPlayer {
  name: string;
  position: Position;
  price: number;
  expectedPrice: number;
  source: "keeper" | LiveDraftPlayerSource;
  teamAbbreviation?: string;
  byeWeek?: number;
}

export type LiveDraftRosterSlotKey =
  | "QB" | "RB1" | "RB2" | "WR1" | "WR2" | "TE" | "FLEX" | "K" | "DST"
  | "BENCH1" | "BENCH2" | "BENCH3" | "BENCH4" | "BENCH5" | "BENCH6" | "BENCH7";

export interface LiveDraftRosterSlot {
  slot: LiveDraftRosterSlotKey;
  player?: LiveDraftRosterPlayer;
}

export interface LiveDraftOwnerState {
  owner: Owner;
  roster: LiveDraftRosterPlayer[];
  slots: LiveDraftRosterSlot[];
  spent: number;
  budgetRemaining: number;
  rosterSlotsRemaining: number;
  maxBid: number;
  positionCounts: Record<Position, number>;
}

export interface LiveDraftRoomState {
  scenarioKey: KeeperScenarioKey;
  totalBudget: number;
  initialKeeperSpend: number;
  actualAuctionSpend: number;
  expectedAuctionSpend: number;
  saleVsExpected: number;
  remainingBudget: number;
  remainingRosterSlots: number;
  remainingExpectedSpend: number;
  liveInflationFactor: number;
}

export interface LiveDraftState {
  strategy: LiveDraftStrategyDefinition;
  scenario: KeeperScenario;
  room: LiveDraftRoomState;
  watchOwner: LiveDraftOwnerState;
  owners: LiveDraftOwnerState[];
  events: LiveDraftEvent[];
  errors: LiveDraftCommandError[];
  postDraftAudit: LiveDraftSaleAudit[];
  availableTargets: LiveDraftTarget[];
  keeperTargets: LiveDraftKeeperTarget[];
  draftPath: LiveDraftPathRecommendation;
  shortlist: LiveDraftShortlistTarget[];
  positionContexts: LiveDraftPositionContext[];
  readiness: LiveDraftReadiness;
}

export type { LiveDraftStrategyKey };
