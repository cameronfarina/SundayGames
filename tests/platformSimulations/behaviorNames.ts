export const simulationBehaviorNames: readonly string[] = [
  "creates simulation requests idempotently for the same user league season and key",
  "rejects an idempotency key reused with different simulation input",
  "maps hard locks to forced sales and persists a runner result summary",
  "only lets the private owner list or read their simulation results",
  "validates run count, hard-lock players, prices, and duplicate hard locks",
  "keeps hard locks without an auction owner private and passes them to the runner constraints",
  "marks runner failures and returns completed runs idempotently",
  "keeps canceled simulation runs from persisting stale completion results",
];
