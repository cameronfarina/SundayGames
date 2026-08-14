export const simulationIdempotencyIndexKey = (
  userId: string,
  leagueId: string,
  seasonId: string,
  idempotencyKey: string,
): string => [userId, leagueId, seasonId, idempotencyKey].join("\0");
