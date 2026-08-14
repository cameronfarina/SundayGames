import type { Owner, Position } from "../../../config/league.js";
import type {
  AuctionBidDriver,
  AuctionBudgetTrajectoryRow,
  AuctionNominationDiagnostics,
  AuctionRoomPressureDiagnostics,
  AuctionSalePriceBasis,
} from "../auctionEngine.js";
import type { KeeperScenarioKey } from "../keeperInflation.js";
import type { MockBatch, MockRun } from "../mockBatch.js";

export interface MockSmokeBidDiagnostic {
  rank: number;
  owner: Owner;
  amount: number;
  uncappedAmount: number;
  maxBid: number;
  cappedByMaxBid: boolean;
  ownerDemandMultiplier: number;
  rosterNeedMultiplier: number;
  scarcityMultiplier: number;
  behaviorAggressionMultiplier: number;
  behaviorScarcityMultiplier: number;
  buildStyleMultiplier: number;
  replacementPatienceMultiplier: number;
  endgamePressureMultiplier: number;
  roomPressureMultiplier: number;
  competitionPressureMultiplier: number;
  budgetPacingMultiplier: number;
  bidVarianceMultiplier: number;
  topEndDampingMultiplier: number;
  positionOverbidDampingMultiplier: number;
  contextPenaltyDampingMultiplier: number;
  drivers: AuctionBidDriver[];
}

export interface MockSmokeSaleResolution {
  secondBidAmount: number;
  reservePrice: number;
  nominatorOpeningBid: number;
  uncappedSalePrice: number;
  topEndGuardedPrice: number;
  salePriceBasis: AuctionSalePriceBasis;
}

export interface MockSmokePick {
  pick: number;
  round: number;
  nominator: Owner;
  winner: Owner;
  player: string;
  position: Position;
  anchorPrice: number;
  salePrice: number;
  saleVsAnchor: number;
  budgetAfterPick: number;
  rosterSlotsAfterPick: number;
  nominationDiagnostics: AuctionNominationDiagnostics;
  roomPressure: AuctionRoomPressureDiagnostics;
  saleResolution: MockSmokeSaleResolution;
  bidDiagnostics: MockSmokeBidDiagnostic[];
}

export interface MockSmokeRoundSummary {
  pickCount: number;
  averageAnchorPrice: number;
  averageSalePrice: number;
  averageSaleVsAnchor: number;
}

export interface MockSmokeScenarioSummary {
  key: KeeperScenarioKey;
  runCount: number;
  invalidRosterCount: number;
  averagePickCount: number;
}

export interface MockSmokeBatchSummary {
  runCount: number;
  invalidRosterCount: number;
  scenarios: MockSmokeScenarioSummary[];
}

export interface MockSmokeReport {
  seed: string;
  scenarioKey: KeeperScenarioKey;
  roundCount: number;
  pickCount: number;
  invalidRosterCount: number;
  firstTwoRounds: MockSmokePick[];
  budgetTrajectory: AuctionBudgetTrajectoryRow[];
  firstTwoRoundSummary: MockSmokeRoundSummary;
  batch: MockSmokeBatchSummary;
  warnings: string[];
}

export interface BuildMockSmokeReportOptions {
  run: MockRun;
  batch: MockBatch;
  rounds?: number;
}
