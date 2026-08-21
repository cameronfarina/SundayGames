import type { ForcedAuctionSale, MockBatch } from "../../modeling/mockBatch.js";
import type { SeasonSimulationResult } from "../seasonSimulationEngine.js";
import type { RunSeasonSimulationsInput } from "../seasonSimulationEngine.js";
import type {
  SimulationHardLock,
  SimulationSoftTarget,
  SimulationStrategy,
  SimulationStrategyInput,
} from "./strategyContracts.js";

export type SimulationRunStatus = "requested" | "running" | "completed" | "failed" | "canceled";

export interface CreateSimulationRequestInput {
  userId: string;
  leagueId: string;
  seasonId: string;
  ownerId: string;
  teamId: string;
  count: number;
  seedPrefix: string;
  idempotencyKey: string;
  strategy: SimulationStrategyInput;
  browserInput?: RunSeasonSimulationsInput | undefined;
  browserInputDigest?: string | undefined;
  browserNote?: string | undefined;
  createdAt?: Date | undefined;
}

export interface SimulationRequest {
  id: string;
  userId: string;
  leagueId: string;
  seasonId: string;
  ownerId: string;
  teamId: string;
  count: number;
  seedPrefix: string;
  idempotencyKey: string;
  strategy: SimulationStrategy;
  privacyOwnerUserId: string;
  inputHash: string;
  browserInput?: RunSeasonSimulationsInput | undefined;
  browserInputDigest?: string | undefined;
  browserNote?: string | undefined;
  createdAt: Date;
}

export interface SimulationResult {
  runId: string;
  requestId: string;
  completedAt: Date;
  runCount: number;
  seedPrefix: string;
  hardLockCount: number;
  softTargetCount: number;
  forcedSales: readonly ForcedAuctionSale[];
  summary: MockBatch["summary"];
  seasonSimulation?: SeasonSimulationResult | undefined;
  strategyText?: string | undefined;
  note?: string | undefined;
  favoriteRunNumbers?: readonly number[] | undefined;
}

export interface SimulationRun {
  id: string;
  request: SimulationRequest;
  status: SimulationRunStatus;
  privacyOwnerUserId: string;
  createdAt: Date;
  startedAt: Date | undefined;
  completedAt: Date | undefined;
  result: SimulationResult | undefined;
}

export interface SimulationRunnerOptions {
  runsPerScenario: number;
  seedPrefix: string;
  forcedSales: readonly ForcedAuctionSale[];
  hardLocks: readonly SimulationHardLock[];
  softTargets: readonly SimulationSoftTarget[];
}

export type SimulationMockBatchRunner =
  (options: SimulationRunnerOptions) => MockBatch | Promise<MockBatch>;
