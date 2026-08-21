import { hashSimulationInput, simulationInputHashPayload } from "./hashing.js";
import { createSimulationId, createSimulationRequestId } from "./identifiers.js";
import type { InMemorySimulationState } from "./inMemoryState.js";
import { makeSimulationRetentionRoom } from "./inMemoryRetention.js";
import { simulationIdempotencyIndexKey } from "./keys.js";
import { assertSimulationCount, assertSimulationRequestIdentifiers } from "./requestValidation.js";
import type { CreateSimulationRequestInput, SimulationRequest, SimulationRun } from "./runContracts.js";
import { normalizeStrategy } from "./strategy.js";
import { SimulationError } from "./errors.js";

export const createInMemorySimulationRequest = (
  state: InMemorySimulationState,
  input: CreateSimulationRequestInput,
): SimulationRun => {
  const createdAt = input.createdAt ?? new Date();
  assertSimulationCount(input.count);
  assertSimulationRequestIdentifiers(input);

  const strategy = normalizeStrategy(input.strategy);
  const inputHash = hashSimulationInput(simulationInputHashPayload(input, strategy));
  const key = simulationIdempotencyIndexKey(
    input.userId,
    input.leagueId,
    input.seasonId,
    input.idempotencyKey,
  );
  const existing = state.getByIdempotencyKey(key);
  if (existing !== undefined) {
    if (existing.request.inputHash !== inputHash) {
      throw new SimulationError(
        "idempotency_conflict",
        "A simulation request already exists for this idempotency key with different input.",
      );
    }
    return existing;
  }

  makeSimulationRetentionRoom(state, input.userId, createdAt);
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
    ...(input.browserInput === undefined ? {} : { browserInput: structuredClone(input.browserInput) }),
    ...(input.browserInputDigest === undefined ? {} : {
      browserInputDigest: input.browserInputDigest,
    }),
    ...(input.browserNote === undefined ? {} : { browserNote: input.browserNote }),
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
  state.store(run);
  return run;
};
