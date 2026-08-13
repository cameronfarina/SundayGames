import { describe, expect, it } from "vitest";
import type { HistoricalSaleRecord } from "../src/platform/historicalImports.js";
import {
  createInMemoryPricingSnapshotRepository,
  type PricingSourcePrice,
} from "../src/platform/pricingSnapshots.js";
import {
  listLeaguePricingSnapshotsWorkflow,
  readLatestLeaguePricingSnapshotWorkflow,
  readLatestPricingSnapshotWorkflow,
  rebuildLeaguePricingWorkflow,
  type RebuildLeaguePricingWorkflowInput,
} from "../src/platform/platformPricingWorkflow.js";

const baselinePrices = [
  {
    name: "Bijan Robinson",
    normalizedName: "bijan robinson",
    position: "RB",
    price: 50,
  },
] satisfies readonly PricingSourcePrice[];

const historicalSale = (
  overrides: Partial<HistoricalSaleRecord> = {},
): HistoricalSaleRecord => ({
  id: "sale-2025-bijan",
  batchId: "batch-2025",
  leagueId: "league-214674",
  leagueSeasonId: "league-season-2025",
  seasonYear: 2025,
  rowNumber: 7,
  ownerId: "owner-cam",
  ownerDisplayName: "Cam",
  playerId: "player-bijan-robinson",
  playerName: "Bijan Robinson",
  position: "RB",
  priceDollars: 70,
  keeper: false,
  acquisitionType: "auction",
  ...overrides,
});

const workflowInput = (
  repository: RebuildLeaguePricingWorkflowInput["repository"],
  overrides: Partial<Omit<RebuildLeaguePricingWorkflowInput, "repository">> = {},
): RebuildLeaguePricingWorkflowInput => ({
  repository,
  leagueId: "league-214674",
  seasonYear: 2026,
  modelVersion: "league-calibration-v1",
  scenarioIds: ["balanced"],
  baselinePrices,
  historicalSaleRecords: [historicalSale()],
  ...overrides,
});

describe("platform pricing workflow", () => {
  it("saves every calibrated scenario and returns persisted snapshot ids", () => {
    const repository = createInMemoryPricingSnapshotRepository();

    const result = rebuildLeaguePricingWorkflow(workflowInput(repository, {
      scenarioIds: ["balanced", "upside"],
      createdAt: "2026-08-09T12:00:00.000Z",
    }));

    expect(result.snapshots.map(snapshot => snapshot.scenarioId)).toEqual([
      "balanced",
      "upside",
    ]);
    expect(result.snapshots.every(snapshot => snapshot.modelRunId === result.modelRunId)).toBe(true);
    expect(result.savedSnapshotIds).toEqual(result.snapshots.map(snapshot => snapshot.snapshotId));
    expect(repository.get(result.modelRunId, "balanced")).toEqual(result.snapshots[0]);
    expect(repository.get(result.modelRunId, "upside")).toEqual(result.snapshots[1]);
  });

  it("keeps same-payload workflow saves idempotent", () => {
    const repository = createInMemoryPricingSnapshotRepository();
    const input = workflowInput(repository, {
      scenarioIds: ["balanced", "upside"],
      createdAt: "2026-08-09T12:00:00.000Z",
    });

    const firstResult = rebuildLeaguePricingWorkflow(input);
    const secondResult = rebuildLeaguePricingWorkflow(input);

    expect(secondResult).toEqual(firstResult);
    expect(repository.list().map(snapshot => snapshot.snapshotId)).toEqual(
      firstResult.savedSnapshotIds,
    );
  });

  it("keeps retries idempotent when only the creation timestamp changes", () => {
    const repository = createInMemoryPricingSnapshotRepository();

    const first = rebuildLeaguePricingWorkflow(workflowInput(repository, {
      createdAt: "2026-08-09T12:00:00.000Z",
    }));
    const retry = rebuildLeaguePricingWorkflow(workflowInput(repository, {
      createdAt: "2026-08-09T12:01:00.000Z",
    }));

    expect(retry).toEqual(first);
    expect(repository.list()).toHaveLength(1);
  });

  it("persists a new pricing model beside an older snapshot for the same inputs", () => {
    const repository = createInMemoryPricingSnapshotRepository();

    const previousModel = rebuildLeaguePricingWorkflow(workflowInput(repository, {
      modelVersion: "league-history-v1",
      createdAt: "2026-08-09T12:00:00.000Z",
    }));
    const currentModel = rebuildLeaguePricingWorkflow(workflowInput(repository, {
      modelVersion: "league-history-v2",
      createdAt: "2026-08-09T12:01:00.000Z",
    }));

    expect(currentModel.modelRunId).not.toBe(previousModel.modelRunId);
    expect(repository.list()).toHaveLength(2);
  });

  it("filters saved snapshots by model run scenario and league season", () => {
    const repository = createInMemoryPricingSnapshotRepository();
    const league2026 = rebuildLeaguePricingWorkflow(workflowInput(repository, {
      scenarioIds: ["balanced", "upside"],
      createdAt: "2026-08-09T12:00:00.000Z",
    }));
    rebuildLeaguePricingWorkflow(workflowInput(repository, {
      seasonYear: "2027",
      scenarioIds: ["balanced"],
      createdAt: "2026-08-09T12:02:00.000Z",
    }));
    rebuildLeaguePricingWorkflow(workflowInput(repository, {
      leagueId: "league-rival",
      historicalSaleRecords: [historicalSale({ leagueId: "league-rival" })],
      scenarioIds: ["balanced"],
      createdAt: "2026-08-09T12:03:00.000Z",
    }));

    const leagueSeasonSnapshots = listLeaguePricingSnapshotsWorkflow(repository, {
      leagueId: "league-214674",
      seasonYear: "2026",
    });
    const upsideSnapshot = readLatestPricingSnapshotWorkflow(repository, {
      modelRunId: league2026.modelRunId,
      scenarioId: "upside",
    });

    expect(leagueSeasonSnapshots).toEqual(league2026.snapshots);
    expect(listLeaguePricingSnapshotsWorkflow(repository, {
      leagueId: "league-214674",
      seasonYear: 2026,
      scenarioId: "upside",
    })).toEqual([league2026.snapshots[1]]);
    expect(upsideSnapshot).toEqual(league2026.snapshots[1]);
  });

  it("reads the latest snapshot for one league season and scenario", () => {
    const repository = createInMemoryPricingSnapshotRepository();
    rebuildLeaguePricingWorkflow(workflowInput(repository, {
      modelVersion: "league-history-v1",
      createdAt: "2026-08-09T12:00:00.000Z",
    }));
    const latest = rebuildLeaguePricingWorkflow(workflowInput(repository, {
      modelVersion: "league-history-v2",
      createdAt: "2026-08-09T12:01:00.000Z",
    }));
    rebuildLeaguePricingWorkflow(workflowInput(repository, {
      leagueId: "league-rival",
      historicalSaleRecords: [historicalSale({ leagueId: "league-rival" })],
      modelVersion: "league-history-v3",
      createdAt: "2026-08-09T12:02:00.000Z",
    }));

    expect(readLatestLeaguePricingSnapshotWorkflow(repository, {
      leagueId: "league-214674",
      seasonYear: "2026",
      scenarioId: "balanced",
    })).toEqual(latest.snapshots[0]);
  });
});
