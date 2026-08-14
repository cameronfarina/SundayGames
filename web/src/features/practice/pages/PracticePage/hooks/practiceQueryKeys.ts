export const practiceQueryKeys = {
  catalog: (seasonId: string | undefined, strategy: string) => ["practice", "catalog", seasonId, strategy],
  context: ["practice", "context"],
  history: (seasonId: string) => ["practice", "history", seasonId],
  shortlist: (seasonId: string) => ["practice", "shortlist", seasonId],
  simulation: (historyId: string) => ["practice", "simulation", historyId],
};
