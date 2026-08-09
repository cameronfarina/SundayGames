# Epic 5: Simulation Engine, Jobs, Results, And Worker Architecture

## Goal

Make simulations a first-class production system. Authenticated users can run private, league-calibrated draft simulations asynchronously, with durable job state, reproducible inputs, queryable results, and worker execution that never blocks API requests.

## Launch-Critical Scope

- Submit simulation jobs for an authenticated user within a league season.
- Support run count, seed/seed prefix, keeper scenario, model run, strategy, forced players at prices, target/cap players, and path constraints.
- Persist job lifecycle in Postgres: queued, running, completed, failed, canceled.
- Run simulations outside the API request path through a worker process.
- Store enough input snapshot data to reproduce or explain a result after league data changes.
- Store result summaries needed by the product: roster variants, player sale ranges, target hit rates, owner/team rankings, budget pressure, invalid roster counts, and representative drafts.
- List, fetch, poll, and cancel the current user's jobs.
- Preserve deterministic local mock-batch behavior while moving orchestration out of memory.
- Enforce strict user privacy for jobs, inputs, and results.

## Deferred Scope

- Public or league-shared result publishing.
- Collaborative/shared simulation folders.
- Worker autoscaling beyond the first production deployment.
- Advanced priority queues and paid-tier scheduling.
- Cross-league benchmarking.
- Long-term warehouse/analytics exports.
- Real-time per-pick streaming unless polling is insufficient.
- External draft-platform writeback.
- Arbitrary user-authored scripting beyond validated constraint types.

## Data Model Impact

- `simulation_jobs`: user, league, season, status, kind, input version, input JSON/hash, idempotency key, run count, completed run count, progress, queue, worker id, locks, timestamps, sanitized error fields.
- `simulation_result_sets`: one row per completed job with summary JSON, engine version, model/keeper/rules snapshot references, result schema version, timestamps.
- `simulation_runs`: optional but launch-useful row per simulated draft/run for seed, scenario, strategy variant, score/rank summaries, validity, and compact roster summary.
- `simulation_run_picks`: optional table if the UI must query pick-by-pick boards without loading a large JSON blob.
- `simulation_result_players`: optional projection table for player sale ranges, exposure, target outcomes, and roster-path queries.

Use `league_id` for shared inputs and `user_id` for private ownership. Do not hard-code one league.

## Job And Worker Architecture

- API validates auth, league membership, ownership boundaries, and input shape, then creates a queued Postgres job and returns `202`.
- Worker claims jobs with Postgres row locking, updates heartbeat/progress, runs the deterministic engine, writes results in a transaction, and marks completion.
- Start with Postgres-backed queue semantics. Add Redis/BullMQ-style infrastructure only when needed.
- Jobs are idempotent by `(user_id, league_id, idempotency_key)` for submit retries.
- Canceled jobs stop before starting when possible; running cancellation can be cooperative at run boundaries.
- Failed jobs retain sanitized owner-visible error details plus server logs for debugging.
- Worker concurrency is configurable and conservative for launch.
- Job execution snapshots or references immutable versions of league rules, keepers, historical pricing, projections, and model runs.

## Simulation Input And Result Contracts

Submit request:

```ts
{
  leagueId: string;
  seasonId: string;
  modelRunId: string;
  keeperScenarioId: string;
  runCount: number;
  seedPrefix?: string;
  strategyKey?: string;
  forcedPlayers?: Array<{ ownerId: string; playerId: string; price: number }>;
  targets?: Array<{ ownerId: string; playerId: string; maxPrice: number }>;
  caps?: Array<{ ownerId: string; playerId: string; maxPrice: number }>;
  pathConstraints?: Array<{
    ownerId: string;
    type: "buildAround" | "positionBudget" | "rosterShape" | "avoidPlayer" | "requirePlayer";
    value: unknown;
  }>;
}
```

Job response:

```ts
{
  jobId: string;
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  runCount: number;
  completedRunCount: number;
  progressPercent: number;
  submittedAt: string;
  updatedAt: string;
}
```

Result response includes job summary, immutable input snapshot, aggregate strategy/roster/player outcomes, validation warnings, and representative runs.

## Privacy Boundaries

- Simulation jobs and results are private to the creating user.
- A league member can use shared league/model inputs, but cannot see another member's simulations.
- Admins can manage shared league data, but do not automatically get access to private prep artifacts.
- All read paths require league membership and `simulation_jobs.user_id = current_user.id`.
- Worker logs redact private strategy constraints.

## Dependencies

- Epic 1 for accounts, sessions, memberships, and permission checks.
- Epic 2 for durable league rules, owners, teams, keepers, and draft settings.
- Epic 4 for immutable model runs and pricing snapshots.
- Epic 7 for plan-to-simulation constraints.
- Epic 8 for submission, progress, results, and comparison UI.
- Epic 10 for worker operations and rate limits.

## Acceptance Criteria

- Submitting a simulation returns quickly with `202` and a durable job id.
- API remains responsive while a large simulation is running.
- A worker can complete a queued job and persist results.
- A user can list, fetch, poll, and cancel only their own jobs.
- A same-league user cannot access another user's jobs or results.
- Completed results remain explainable against the input snapshot used at execution time.
- Re-running the same deterministic input and seed produces equivalent results.
- Failed jobs surface useful owner-visible errors without leaking internals.
- The implementation supports the first production league without hard-coding it.

## Test And Verification Strategy

- Unit tests for input validation, constraint normalization, idempotency keys, and status transitions.
- Authorization tests for unauthenticated, non-member, same-league non-owner, owner, and admin paths.
- Worker tests for claim, progress, completion, failure, retry, stale lock recovery, and cancellation.
- Contract tests for submit/status/result APIs.
- Determinism tests comparing worker output to existing local mock-batch behavior for fixed seeds.
- Migration/constraint tests for ownership, unique idempotency, and foreign keys.
- Load smoke test for 18 users each submitting moderate run counts.
- Manual end-to-end smoke: submit job, watch progress, open results, compare roster variations.

## Risks And Open Questions

- Decide whether result detail is stored mostly as JSON snapshots, normalized query tables, or both.
- Define launch limits for `runCount`, concurrent jobs per user, and total worker concurrency.
- Decide retention policy for large result payloads.
- Confirm whether polling is enough for launch progress updates.
- Define exact constraint vocabulary before allowing anything user-authored beyond validated types.
- Decide how immutable model runs, keeper snapshots, and league rules are versioned.
- Watch payload size for pick-by-pick diagnostics.
