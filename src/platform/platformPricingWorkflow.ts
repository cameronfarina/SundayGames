import {
  createLeagueCalibratedPricingSnapshots,
  type CreateLeagueCalibratedPricingSnapshotsInput,
} from "./pricingRebuild.js";
import type {
  PricingSnapshot,
  PricingSnapshotRepository,
} from "./pricingSnapshots.js";
import { assertPricingSnapshotCanBeSaved } from "./pricingSnapshots.js";

export interface RebuildLeaguePricingWorkflowInput extends CreateLeagueCalibratedPricingSnapshotsInput {
  repository: PricingSnapshotRepository;
}

export interface RebuildLeaguePricingWorkflowResult {
  modelRunId: string;
  snapshots: readonly PricingSnapshot[];
  savedSnapshotIds: readonly string[];
}

export interface PreflightLeaguePricingWorkflowResult {
  modelRunId: string;
  snapshots: readonly PricingSnapshot[];
}

export interface PricingSnapshotReadWorkflowFilters {
  modelRunId: string;
  scenarioId?: string;
}

export interface ListLeaguePricingSnapshotsWorkflowFilters {
  leagueId: string;
  seasonYear: number | string;
  modelRunId?: string;
  scenarioId?: string;
}

const sameSeasonYear = (left: number | string, right: number | string): boolean =>
  String(left) === String(right);

export const rebuildLeaguePricingWorkflow = (
  input: RebuildLeaguePricingWorkflowInput,
): RebuildLeaguePricingWorkflowResult => {
  const prepared = preflightLeaguePricingWorkflow(input);
  const savedSnapshots = prepared.snapshots.map(snapshot => input.repository.save(snapshot));
  const firstSnapshot = savedSnapshots[0];
  if (firstSnapshot === undefined) {
    throw new Error("Pricing rebuild workflow did not create any snapshots.");
  }

  return {
    modelRunId: firstSnapshot.modelRunId,
    snapshots: savedSnapshots,
    savedSnapshotIds: savedSnapshots.map(snapshot => snapshot.snapshotId),
  };
};

export const preflightLeaguePricingWorkflow = (
  input: RebuildLeaguePricingWorkflowInput,
): PreflightLeaguePricingWorkflowResult => {
  const { repository, ...pricingInput } = input;
  const snapshots = createLeagueCalibratedPricingSnapshots(pricingInput);
  snapshots.forEach(snapshot => assertPricingSnapshotCanBeSaved(repository, snapshot));
  const firstSnapshot = snapshots[0];
  if (firstSnapshot === undefined) {
    throw new Error("Pricing rebuild workflow did not create any snapshots.");
  }

  return {
    modelRunId: firstSnapshot.modelRunId,
    snapshots,
  };
};

export const readLatestPricingSnapshotWorkflow = (
  repository: PricingSnapshotRepository,
  filters: PricingSnapshotReadWorkflowFilters,
): PricingSnapshot | undefined =>
  repository.get(filters.modelRunId, filters.scenarioId);

export const listLeaguePricingSnapshotsWorkflow = (
  repository: PricingSnapshotRepository,
  filters: ListLeaguePricingSnapshotsWorkflowFilters,
): readonly PricingSnapshot[] =>
  repository.list().filter(snapshot =>
    snapshot.leagueId === filters.leagueId
      && sameSeasonYear(snapshot.seasonYear, filters.seasonYear)
      && (filters.modelRunId === undefined || snapshot.modelRunId === filters.modelRunId)
      && (filters.scenarioId === undefined || snapshot.scenarioId === filters.scenarioId)
  );
