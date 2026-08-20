import { SeasonSimulationError } from "./seasonSimulationEngine.js";
import { encodeSeasonSimulationExecutionJobInput } from "./seasonSimulationJobPayload.js";
import type {
  AdmitSeasonSimulationInput,
  AdmittedSeasonSimulation,
  SeasonSimulationAdmissionRepository,
} from "./seasonSimulationAdmissions.js";
import { idempotencyKeyFor } from "./platformJobOrchestrator/idempotency.js";
import { platformJobTypes } from "./platformJobOrchestrator/platformJobTypes.js";
import type { SeasonSimulationExecutionJobPayload } from "./platformJobOrchestrator/payloads.js";
import { createRequestWithClient } from "./postgresSimulations/createRequest.js";
import { submitJobWithClient } from "./postgresJobQueue/submit.js";
import { jobFromRow } from "./postgresJobQueue/jobRow.js";
import type { JobQueueContext, JobRow, PostgresTransactionalQueryClient } from "./postgresJobQueue/types.js";

export class PostgresSeasonSimulationAdmissionRepository
implements SeasonSimulationAdmissionRepository {
  readonly #client: PostgresTransactionalQueryClient;

  constructor(client: PostgresTransactionalQueryClient) {
    this.#client = client;
  }

  async admit(input: AdmitSeasonSimulationInput): Promise<AdmittedSeasonSimulation> {
    return await this.#client.transaction(async client => {
      const run = await createRequestWithClient({
        userId: input.userId,
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        ownerId: input.ownerId,
        teamId: input.teamId,
        count: input.count,
        seedPrefix: input.seedPrefix,
        idempotencyKey: input.idempotencyKey,
        strategy: {},
        createdAt: input.now,
      }, client);
      const existing = await client.query<JobRow>(
        `SELECT * FROM jobs
         WHERE user_id = $1 AND kind = 'season_simulation'
           AND input_json->>'simulationRunId' = $2
         ORDER BY created_at DESC LIMIT 1`,
        [input.userId, run.id],
      );
      const existingRow = existing.rows[0];
      if (existingRow !== undefined) return { run, job: jobFromRow(existingRow) };

      const active = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM jobs
         WHERE user_id = $1 AND kind = 'season_simulation'
           AND status IN ('queued', 'running')`,
        [input.userId],
      );
      if (Number(active.rows[0]?.count ?? "0") >= 1) {
        throw new SeasonSimulationError(
          "simulation_account_queue_full",
          "Finish or cancel your active simulation before starting another one.",
        );
      }

      const payload: SeasonSimulationExecutionJobPayload = {
        type: platformJobTypes.seasonSimulationExecution,
        simulationRunId: run.id,
        runCount: input.count,
        seedPrefix: input.seedPrefix,
        seasonSimulation: encodeSeasonSimulationExecutionJobInput({
          simulationInput: input.simulationInput,
          strategyText: input.strategyText,
          ...(input.note === undefined ? {} : { note: input.note }),
        }),
      };
      const context: JobQueueContext = { client: this.#client };
      const job = await submitJobWithClient(context, {
        userId: input.userId,
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        kind: "season_simulation",
        inputJson: payload,
        idempotencyKey: idempotencyKeyFor(payload.type, undefined, [run.id]),
        now: input.now,
      }, client);
      return { run, job };
    });
  }
}
