import type { SaveExportArtifactOptions } from "../exportArtifacts.js";

export const requireCreatedByUserId = (
  options: SaveExportArtifactOptions | undefined,
): string => {
  const createdByUserId = options?.createdByUserId;
  if (createdByUserId === undefined || createdByUserId.trim().length === 0) {
    throw new Error("createdByUserId is required when saving Postgres export artifacts.");
  }

  return createdByUserId;
};
