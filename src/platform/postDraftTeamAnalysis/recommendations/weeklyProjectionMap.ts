import type { PostDraftProjection } from "../contracts/projections.js";

export const weeklyProjectionMap = (
  projections: readonly PostDraftProjection[],
): ReadonlyMap<string, PostDraftProjection> => {
  const weekly = new Map<string, PostDraftProjection>();
  for (const projection of projections) {
    if (
      typeof projection.weeklyProjectedPoints === "number" &&
      Number.isFinite(projection.weeklyProjectedPoints)
    ) {
      weekly.set(projection.playerId, {
        ...projection,
        seasonProjectedPoints: projection.weeklyProjectedPoints,
      });
    }
  }
  return weekly;
};
