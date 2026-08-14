import {
  SimulationError,
  assertSimulationCount,
  assertSimulationRequestIdentifiers,
  createSimulationId,
  createSimulationRequestId,
  hashSimulationInput,
  normalizeStrategy,
  simulationInputHashPayload,
  type CreateSimulationRequestInput,
  type SimulationRequest,
  type SimulationRun,
} from "../simulations.js";
import { maximumRetainedSimulationRunsPerUser } from "../simulationLimits.js";
import { jsonbParameter } from "./json.js";
import { findByIdempotency } from "./lookups.js";
import { runFromRow } from "./runCodec.js";
import { insertSimulationRunSql, pruneTerminalRunsSql } from "./sql.js";
import { firstRow, type SimulationRepositoryContext, type SimulationRunRow } from "./types.js";

export const createRequest = async (
  context: SimulationRepositoryContext,
  input: CreateSimulationRequestInput,
): Promise<SimulationRun> => {
  const createdAt = input.createdAt ?? new Date();
  assertSimulationCount(input.count);
  assertSimulationRequestIdentifiers(input);
  const strategy = normalizeStrategy(input.strategy);
  const inputHash = hashSimulationInput(simulationInputHashPayload(input, strategy));
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
  return await context.client.transaction(async client => {
    await client.query("SELECT id FROM accounts WHERE id = $1 FOR UPDATE", [input.userId]);
    const existingRun = await findByIdempotency(input, client);
    if (existingRun !== null) {
      if (existingRun.request.inputHash !== inputHash) {
        throw new SimulationError(
          "idempotency_conflict",
          "A simulation request already exists for this idempotency key with different input.",
        );
      }
      return existingRun;
    }
    await client.query(pruneTerminalRunsSql, [
      input.userId,
      maximumRetainedSimulationRunsPerUser,
    ]);
    const result = await client.query<SimulationRunRow>(insertSimulationRunSql, [
      createSimulationId(), input.leagueId, input.seasonId, input.userId,
      input.ownerId, input.teamId, input.idempotencyKey, inputHash,
      jsonbParameter(request), createdAt, maximumRetainedSimulationRunsPerUser,
    ]);
    const insertedRow = firstRow(result);
    if (insertedRow !== undefined) return runFromRow(insertedRow);
    throw new SimulationError(
      "simulation_capacity_reached",
      "Finish or cancel an active simulation before starting another one.",
    );
  });
};
