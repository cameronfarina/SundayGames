import { seasonQueryKeys } from "../../../../../shared/api/queries/seasonQueryKeys";

export const practiceQueryKeys = {
  catalog: seasonQueryKeys.practiceCatalog,
  history: (seasonId: string) => ["practice", "history", seasonId],
  shortlist: (seasonId: string) => ["practice", "shortlist", seasonId],
  simulation: (historyId: string) => ["practice", "simulation", historyId],
  simulationRun: (historyId: string, runNumber: number) => ["practice", "simulation", historyId, "run", runNumber],
};
