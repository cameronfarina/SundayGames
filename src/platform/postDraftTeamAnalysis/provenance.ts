import type {
  AnalyzePostDraftTeamInput,
  PostDraftProjectionProvenance,
} from "./contracts/projections.js";

export const projectionProvenance = (
  input: AnalyzePostDraftTeamInput,
): PostDraftProjectionProvenance => {
  const metadata = input.projectionSnapshot.metadata;
  return {
    snapshotId: metadata.snapshotId,
    generatedAt: metadata.generatedAt,
    validThrough: metadata.validThrough,
    ...(metadata.scoringSettingsId === undefined ? {} : { scoringSettingsId: metadata.scoringSettingsId }),
    ...(metadata.week === undefined ? {} : { week: metadata.week }),
    ...(metadata.source === undefined ? {} : { source: { ...metadata.source } }),
  };
};
