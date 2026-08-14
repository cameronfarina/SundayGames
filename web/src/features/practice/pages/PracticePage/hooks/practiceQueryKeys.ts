export const practiceQueryKeys = {
  catalog: (seasonId: string | undefined, strategy: string) => ["practice", "catalog", seasonId, strategy],
  history: (seasonId: string) => ["practice", "history", seasonId],
  shortlist: (seasonId: string) => ["practice", "shortlist", seasonId],
  simulation: (historyId: string) => ["practice", "simulation", historyId],
  simulationRun: (historyId: string, runNumber: number) => ["practice", "simulation", historyId, "run", runNumber],
};
