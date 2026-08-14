import {
  SeasonMockConfigurationSnapshotError,
  type SeasonMockConfigurationSnapshotState,
  type SeasonMockConfigurationSnapshotV2,
  type SeasonMockReplayConfiguration,
} from "./contracts.js";

export const requireSeasonMockConfigurationSnapshot = (
  state: SeasonMockConfigurationSnapshotState,
): SeasonMockConfigurationSnapshotV2 => {
  if (state.status === "ready") return state;
  const message = state.reason === "missing-snapshot"
    ? "This mock draft predates immutable configuration snapshots and must be restarted."
    : `This mock draft uses unsupported configuration snapshot version ${state.sourceVersion ?? "unknown"} and must be migrated.`;
  throw new SeasonMockConfigurationSnapshotError("snapshot_migration_required", message);
};

export const seasonMockReplayConfiguration = (
  state: SeasonMockConfigurationSnapshotState,
): SeasonMockReplayConfiguration => {
  const { payload } = requireSeasonMockConfigurationSnapshot(state);
  return {
    season: payload.season,
    setup: {
      ...payload.setup,
      updatedAt: new Date(payload.setup.updatedAt),
    },
    humanTeamId: payload.humanTeamId,
    playerExpectedPrices: payload.playerExpectedPrices,
    playerHumanValues: payload.playerHumanValues,
  };
};
