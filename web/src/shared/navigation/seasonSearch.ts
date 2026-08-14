export const searchForSeason = (
  current: URLSearchParams,
  seasonId: string,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  next.delete("runId");
  next.delete("sessionId");
  next.delete("simulationRun");
  next.set("seasonId", seasonId);
  return next;
};
