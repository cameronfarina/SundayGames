import { createHash, randomBytes } from "node:crypto";
import type { Owner } from "../../config/league.js";
import type { ForcedAuctionSale, MockBatch } from "../modeling/mockBatch.js";

export const maxSimulationCount = 500;

export type SimulationPriceMode = "exact" | "ceiling";
export type SimulationRunStatus = "requested" | "running" | "completed" | "failed";

export type SimulationErrorCode =
  | "duplicate_hard_lock"
  | "idempotency_conflict"
  | "invalid_count"
  | "invalid_hard_lock_price"
  | "invalid_soft_target_candidate_pool"
  | "invalid_soft_target_label"
  | "invalid_soft_target_max_bid"
  | "missing_hard_lock_player"
  | "simulation_not_found";

export class SimulationError extends Error {
  readonly code: SimulationErrorCode;

  constructor(code: SimulationErrorCode, message: string) {
    super(message);
    this.name = "SimulationError";
    this.code = code;
  }
}

export interface SimulationHardLockInput {
  playerName: string;
  price: number;
  priceMode?: SimulationPriceMode;
  auctionOwner?: Owner;
}

export interface SimulationHardLock {
  playerName: string;
  price: number;
  priceMode: SimulationPriceMode;
  auctionOwner: Owner | undefined;
}

export interface SimulationSoftTargetInput {
  label: string;
  candidatePool: readonly string[];
  maxBid: number;
}

export interface SimulationSoftTarget {
  label: string;
  candidatePool: readonly string[];
  maxBid: number;
}

export interface SimulationStrategyInput {
  hardLocks?: readonly SimulationHardLockInput[];
  softTargets?: readonly SimulationSoftTargetInput[];
}

export interface SimulationStrategy {
  hardLocks: readonly SimulationHardLock[];
  softTargets: readonly SimulationSoftTarget[];
}

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

export interface ExecuteSimulationRunInput {
  repository: InMemorySimulationRepository;
  runId: string;
  runner: SimulationMockBatchRunner;
  now?: Date | undefined;
}

const simulationIdBytes = 16;

const createSimulationId = (): string => `sim_${randomBytes(simulationIdBytes).toString("base64url")}`;

const createSimulationRequestId = (): string =>
  `simreq_${randomBytes(simulationIdBytes).toString("base64url")}`;

const idempotencyIndexKey = (
  userId: string,
  leagueId: string,
  seasonId: string,
  idempotencyKey: string,
): string => [userId, leagueId, seasonId, idempotencyKey].join("\0");

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  const serializedEntries = entries
    .filter(([, entryValue]) => entryValue !== undefined)
    .map(([entryKey, entryValue]) => `${JSON.stringify(entryKey)}:${stableStringify(entryValue)}`);

  return `{${serializedEntries.join(",")}}`;
};

const hashSimulationInput = (input: unknown): string =>
  createHash("sha256").update(stableStringify(input)).digest("base64url");

const normalizePlayerKey = (playerName: string): string =>
  playerName.trim().toLowerCase().replace(/\s+/g, " ");

const assertSimulationCount = (count: number): void => {
  if (!Number.isInteger(count) || count < 1) {
    throw new SimulationError("invalid_count", "Simulation count must be at least 1.");
  }

  if (count > maxSimulationCount) {
    throw new SimulationError("invalid_count", `Simulation count cannot exceed ${maxSimulationCount}.`);
  }
};

const normalizeHardLocks = (
  hardLocks: readonly SimulationHardLockInput[] = [],
): readonly SimulationHardLock[] => {
  const seenPlayerNamesByKey = new Map<string, string>();
  const normalizedHardLocks: SimulationHardLock[] = [];

  for (const hardLock of hardLocks) {
    const playerName = hardLock.playerName.trim();

    if (playerName.length === 0) {
      throw new SimulationError("missing_hard_lock_player", "Hard locks must include a player name.");
    }

    if (!Number.isInteger(hardLock.price) || hardLock.price < 1) {
      throw new SimulationError(
        "invalid_hard_lock_price",
        `Hard lock for ${playerName} must use a positive whole-dollar price.`,
      );
    }

    const playerKey = normalizePlayerKey(playerName);
    const firstPlayerName = seenPlayerNamesByKey.get(playerKey);
    if (firstPlayerName !== undefined) {
      throw new SimulationError("duplicate_hard_lock", `Hard lock duplicates ${firstPlayerName}.`);
    }
    seenPlayerNamesByKey.set(playerKey, playerName);

    normalizedHardLocks.push({
      playerName,
      price: hardLock.price,
      priceMode: hardLock.priceMode ?? "exact",
      auctionOwner: hardLock.auctionOwner,
    });
  }

  return normalizedHardLocks;
};

const normalizeSoftTargets = (
  softTargets: readonly SimulationSoftTargetInput[] = [],
): readonly SimulationSoftTarget[] =>
  softTargets.map(softTarget => {
    const label = softTarget.label.trim();
    const candidatePool = softTarget.candidatePool
      .map(candidate => candidate.trim())
      .filter(candidate => candidate.length > 0);

    if (label.length === 0) {
      throw new SimulationError("invalid_soft_target_label", "Soft targets must include a label.");
    }

    if (candidatePool.length === 0) {
      throw new SimulationError(
        "invalid_soft_target_candidate_pool",
        `Soft target ${label} must include at least one candidate.`,
      );
    }

    if (!Number.isInteger(softTarget.maxBid) || softTarget.maxBid < 1) {
      throw new SimulationError(
        "invalid_soft_target_max_bid",
        `Soft target ${label} must use a positive whole-dollar max bid.`,
      );
    }

    return {
      label,
      candidatePool,
      maxBid: softTarget.maxBid,
    };
  });

const normalizeStrategy = (strategy: SimulationStrategyInput): SimulationStrategy => ({
  hardLocks: normalizeHardLocks(strategy.hardLocks),
  softTargets: normalizeSoftTargets(strategy.softTargets),
});

const simulationInputHashPayload = (
  input: Omit<CreateSimulationRequestInput, "createdAt">,
  strategy: SimulationStrategy,
): unknown => ({
  userId: input.userId,
  leagueId: input.leagueId,
  seasonId: input.seasonId,
  ownerId: input.ownerId,
  teamId: input.teamId,
  count: input.count,
  seedPrefix: input.seedPrefix,
  strategy,
});

export const canReadSimulationRun = (userId: string, run: SimulationRun): boolean =>
  run.privacyOwnerUserId === userId;

export const forcedSalesForSimulationRequest = (
  request: SimulationRequest,
): readonly ForcedAuctionSale[] =>
  request.strategy.hardLocks.flatMap(hardLock =>
    hardLock.auctionOwner === undefined
      ? []
      : [{
        owner: hardLock.auctionOwner,
        player: hardLock.playerName,
        price: hardLock.price,
      }],
  );

export class InMemorySimulationRepository {
  readonly #runsById = new Map<string, SimulationRun>();
  readonly #runIdsByIdempotencyKey = new Map<string, string>();

  constructor(runs: readonly SimulationRun[] = []) {
    this.replaceRuns(runs);
  }

  createRequest(input: CreateSimulationRequestInput): SimulationRun {
    const createdAt = input.createdAt ?? new Date();

    assertSimulationCount(input.count);

    const strategy = normalizeStrategy(input.strategy);
    const inputHash = hashSimulationInput(simulationInputHashPayload(input, strategy));
    const indexKey = idempotencyIndexKey(input.userId, input.leagueId, input.seasonId, input.idempotencyKey);
    const existingRunId = this.#runIdsByIdempotencyKey.get(indexKey);

    if (existingRunId !== undefined) {
      const existingRun = this.#runsById.get(existingRunId);

      if (existingRun !== undefined) {
        if (existingRun.request.inputHash !== inputHash) {
          throw new SimulationError(
            "idempotency_conflict",
            "A simulation request already exists for this idempotency key with different input.",
          );
        }

        return existingRun;
      }
    }

    const request: SimulationRequest = {
      id: createSimulationRequestId(),
      userId: input.userId,
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      ownerId: input.ownerId,
      teamId: input.teamId,
      count: input.count,
      seedPrefix: input.seedPrefix,
      idempotencyKey: input.idempotencyKey,
      strategy,
      privacyOwnerUserId: input.userId,
      inputHash,
      createdAt,
    };
    const run: SimulationRun = {
      id: createSimulationId(),
      request,
      status: "requested",
      privacyOwnerUserId: input.userId,
      createdAt,
      startedAt: undefined,
      completedAt: undefined,
      result: undefined,
    };

    this.#storeRun(run);

    return run;
  }

  listForUser(userId: string): SimulationRun[] {
    return [...this.#runsById.values()].filter(run => canReadSimulationRun(userId, run));
  }

  fetchForUser(runId: string, userId: string): SimulationRun | null {
    const run = this.#runsById.get(runId);

    if (run === undefined || !canReadSimulationRun(userId, run)) {
      return null;
    }

    return run;
  }

  find(runId: string): SimulationRun {
    const run = this.#runsById.get(runId);

    if (run === undefined) {
      throw new SimulationError("simulation_not_found", "Simulation run was not found.");
    }

    return run;
  }

  markRunning(runId: string, now: Date): SimulationRun {
    const run = this.find(runId);

    run.status = "running";
    run.startedAt = now;

    return run;
  }

  markFailed(runId: string): SimulationRun {
    const run = this.find(runId);

    run.status = "failed";

    return run;
  }

  complete(runId: string, result: SimulationResult): SimulationRun {
    const run = this.find(runId);

    run.status = "completed";
    run.completedAt = result.completedAt;
    run.result = result;

    return run;
  }

  runs(): SimulationRun[] {
    return [...this.#runsById.values()].map(run => structuredClone(run));
  }

  replaceRuns(runs: readonly SimulationRun[]): void {
    this.#runsById.clear();
    this.#runIdsByIdempotencyKey.clear();

    for (const run of runs) {
      this.#storeRun(structuredClone(run));
    }
  }

  #storeRun(run: SimulationRun): void {
    this.#runsById.set(run.id, run);
    this.#runIdsByIdempotencyKey.set(
      idempotencyIndexKey(
        run.request.userId,
        run.request.leagueId,
        run.request.seasonId,
        run.request.idempotencyKey,
      ),
      run.id,
    );
  }
}

export const executeSimulationRun = async ({
  repository,
  runId,
  runner,
  now,
}: ExecuteSimulationRunInput): Promise<SimulationRun> => {
  const runAt = now ?? new Date();
  const existingRun = repository.find(runId);
  if (existingRun.status === "completed" && existingRun.result !== undefined) {
    return existingRun;
  }

  const run = repository.markRunning(runId, runAt);
  const forcedSales = forcedSalesForSimulationRequest(run.request);
  let batch: MockBatch;

  try {
    batch = await runner({
      runsPerScenario: run.request.count,
      seedPrefix: run.request.seedPrefix,
      forcedSales,
      hardLocks: run.request.strategy.hardLocks,
      softTargets: run.request.strategy.softTargets,
    });
  } catch (error) {
    repository.markFailed(run.id);
    throw error;
  }

  const result: SimulationResult = {
    runId: run.id,
    requestId: run.request.id,
    completedAt: runAt,
    runCount: batch.summary.runCount,
    seedPrefix: run.request.seedPrefix,
    hardLockCount: run.request.strategy.hardLocks.length,
    softTargetCount: run.request.strategy.softTargets.length,
    forcedSales,
    summary: batch.summary,
  };

  return repository.complete(run.id, result);
};
