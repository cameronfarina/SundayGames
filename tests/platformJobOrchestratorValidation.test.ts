import { describe, expect, it } from "vitest";
import {
  InMemoryJobQueue,
  type FailJobInput,
  type JobRecord,
} from "../src/platform/jobs.js";
import {
  dispatchNextPlatformJob,
  enqueueDraftRoomExportJob,
  PlatformJobOrchestratorError,
  platformJobTypes,
} from "../src/platform/platformJobOrchestrator.js";

const now = new Date("2026-08-09T12:00:00.000Z");

class FailureCapturingJobQueue extends InMemoryJobQueue {
  capturedError: unknown;

  override failJob(input: FailJobInput): JobRecord {
    this.capturedError = input.error;
    return super.failJob(input);
  }
}

const expectOrchestratorFailure = (
  repository: FailureCapturingJobQueue,
  expectedCode: PlatformJobOrchestratorError["code"],
): void => {
  expect(repository.capturedError).toBeInstanceOf(PlatformJobOrchestratorError);
  if (!(repository.capturedError instanceof PlatformJobOrchestratorError)) {
    throw new Error("Expected an orchestrator error.");
  }
  expect(repository.capturedError.code).toBe(expectedCode);
};

describe("platform job orchestrator validation", () => {
  it("fails a known job type whose persisted payload is malformed", async () => {
    const repository = new FailureCapturingJobQueue();
    repository.submit({
      userId: "user_cam",
      leagueId: "league_100001",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: {
        type: platformJobTypes.simulationRunExecution,
        simulationRunId: "sim_invalid",
        runCount: 0,
      },
      idempotencyKey: "invalid-simulation",
      maxAttempts: 1,
      now,
    });

    await dispatchNextPlatformJob({
      repository,
      workerId: "worker_validation",
      now,
      handlers: {},
    });

    expectOrchestratorFailure(repository, "invalid_payload");
  });

  it("fails a valid job when its handler is not registered", async () => {
    const repository = new FailureCapturingJobQueue();
    enqueueDraftRoomExportJob({
      repository,
      userId: "user_cam",
      leagueId: "league_100001",
      seasonId: "season_2026",
      draftRoomId: "room_final",
      format: "csv",
      sourceRevision: 7,
      maxAttempts: 1,
      now,
    });

    await dispatchNextPlatformJob({
      repository,
      workerId: "worker_validation",
      now,
      handlers: {},
    });

    expectOrchestratorFailure(repository, "missing_handler");
  });
});
