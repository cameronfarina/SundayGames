# Epic 10: Export, Operations, Backups, Observability, And Reliability

## Goal

Make Mockd production-operable for the first league of about 18 users while preserving a durable path to more leagues. Postgres is the production source of truth, live draft state is delivered through SSE with polling fallback, and final draft output is exportable as one spreadsheet-style sheet for league use outside Mockd.

## Launch-Critical Scope

- Final draft export for a league season as one sheet with team columns and player/price rows.
- Production Postgres deployment, migrations, backup schedule, restore runbook, and disaster recovery expectations.
- SSE live update infrastructure with authenticated streams, reconnect behavior, event cursors, and polling fallback.
- Worker/job reliability for imports, pricing/model runs, exports, and async maintenance tasks.
- Structured logging, request IDs, error reporting, basic metrics, and operational dashboards.
- Rate limits for auth, imports, exports, model runs, live draft mutations, SSE connections, and polling fallback.
- Production deployment topology with web, worker, database, cache/queue, and scheduled maintenance processes.
- Explicit user-facing error states for unavailable exports, stale draft state, failed jobs, failed imports, and degraded live updates.

## Deferred Scope

- ESPN import/writeback.
- Multi-region active-active deployment.
- Self-serve tenant provisioning and billing operations.
- Advanced data warehouse/BI pipelines.
- Full audit-log UI beyond launch-critical security and draft-action audit events.
- Automated restore drills beyond documented/manual launch rehearsal.
- Complex autoscaling policies beyond modest production headroom.
- Long-term object retention policies for uploaded/import/export artifacts.

## Export Contract

- Export shape: one workbook with one primary sheet, `Draft Results`.
- Sheet layout: two columns per fantasy team, ordered by league draft/team order:
  - `{Team Name} Player`
  - `{Team Name} Price`
- Rows align roster slots by draft result order within each team. Empty slots remain blank.
- Prices are exported as numeric currency values, not formatted strings.
- Include keepers and live-auction purchases in the same team columns.
- Header metadata belongs above or alongside the sheet: league name, season, generated timestamp, model/run id, draft session id.
- Export reads committed Postgres draft results only. Generated files are artifacts, never source of truth.
- Export is reproducible for the same draft session state and includes enough metadata to trace source records.
- Supported launch formats: `.xlsx` primary, `.csv` fallback.
- Permission: league members can download final shared export; only commissioner/admin can regenerate from mutable or in-progress draft state.

## Production Architecture

- Web process serves authenticated app/API traffic, SSE streams, and polling fallback endpoints.
- Worker process handles file parsing, model recalculation, export generation, cleanup, and scheduled health tasks.
- Postgres is authoritative for users, sessions, leagues, imports, pricing snapshots, draft sessions, draft events, jobs, and export metadata.
- Redis or equivalent cache/queue is used for job dispatch, short-lived rate-limit counters, SSE fanout coordination, and ephemeral locks only when Postgres is no longer enough.
- SSE is primary for live draft updates:
  - authenticated before connection opens
  - scoped to league season/draft session
  - emits ordered events with monotonic sequence/cursor
  - supports reconnect from last received cursor
  - heartbeat keeps connections observable
- Polling fallback reads the same persisted draft event stream/read model and never becomes a second write path.
- Deploy topology separates web and worker scaling.
- Scheduled tasks run as a single controlled process or idempotent job runner.
- All state-changing draft actions are persisted transactionally before fanout.

## Database, Backup, And Recovery

- Migrations are forward-only, reviewed, and deployed before code paths require new schema.
- Transactional migrations are preferred; large data changes run as resumable jobs.
- Backups:
  - automated daily full Postgres backups
  - point-in-time recovery if provider supports WAL/PITR
  - pre-draft UTC PITR marker and on-demand logical export
  - pre-migration backup for risky changes
- Recovery targets:
  - launch RPO: at most 24 hours normally, tighter during draft day via the recorded PITR point and logical export
  - launch RTO: documented restore path within hours
- Restore runbook covers identifying target backup, restoring to isolated database, verifying core records, promoting/copying data, invalidating stale sessions if needed, and regenerating exports/read models.
- Draft events are append-friendly so final state can be rebuilt if derived state is corrupted.

## Observability And Logging

- Structured JSON logs for API requests, auth events, job lifecycle, import/export lifecycle, model runs, SSE connect/disconnect/reconnect, and live draft mutations.
- Every request/job has a request ID or correlation ID.
- Logs avoid session tokens, passwords, raw cookies, and unnecessary uploaded file contents.
- Metrics:
  - request latency/error rate by route
  - auth failures and rate-limit hits
  - active SSE connections
  - SSE reconnects and fallback polling rate
  - draft mutation latency
  - worker queue depth, job duration, retries, dead jobs
  - Postgres connection count, query latency, backup success/failure
  - export generation success/failure/duration
- Alerts cover app/database availability, backup failures, stalled queues, repeated export/job failures, elevated 5xx, and auth/rate-limit anomalies during draft window.

## Security And Rate Limits

- Secure HttpOnly session cookies from Epic 1 remain the only launch auth mechanism.
- All league-scoped routes enforce membership server-side.
- Commissioner/admin-only routes protect setup, import commit, model publish, draft mutation, and forced export regeneration.
- Rate limits cover login/signup/password reset, upload/import/export, model runs, live draft mutations, SSE connection count, and polling cadence.
- Uploads enforce file type, size, row-count, and parser time limits.
- Background jobs are idempotent or guarded by uniqueness keys.
- Secrets live in production environment configuration, never source.
- Operational access to backups and production database is limited and audited.

## Dependencies

- Epic 1 for sessions, memberships, authorization, and SSE authentication.
- Epic 2 for league season, team order, keeper/draft settings, and final shared draft state.
- Epic 3 for import jobs, uploaded artifacts, and historical data persistence.
- Epic 4 for model runs, pricing snapshot persistence, and recalculation jobs.
- Epic 5 for async simulation/job infrastructure.
- Epic 7 for private data boundaries in logs and operations.
- Epic 9 for live draft room event model, mutation contract, and SSE payloads.

## Acceptance Criteria

- A member can download a final draft export with one sheet, team columns, player names, and numeric prices.
- Exported results match committed Postgres draft results for the league season.
- SSE clients receive ordered live draft updates and reconnect from a cursor without duplicating state.
- Polling fallback returns the same current draft state as the SSE stream.
- Workers retry transient failures, mark permanent failures, and expose user-visible error states.
- Production deploy includes web, worker, Postgres, queue/cache decision, scheduled jobs, and documented environment variables.
- Backups run automatically and failures alert.
- A restore runbook exists and has been rehearsed at least once against a non-production database.
- Logs and metrics can answer what failed, for which league/session/job, when, and whether users were affected.
- Rate limits protect auth, draft mutation, export, import, model-run, SSE, and polling paths without blocking normal launch usage.

## Test And Verification Strategy

- Unit tests for export row/column generation, price typing, ordering, blank roster slots, and metadata.
- Contract tests proving export reads only committed Postgres draft state.
- API permission tests for export download/regeneration, SSE connect, polling fallback, and draft mutations.
- SSE integration tests for connect, heartbeat, event order, cursor reconnect, disconnect, and fallback polling.
- Worker tests for idempotency, retry, timeout, dead-job state, and user-facing failure messages.
- Migration tests for constraints and recovery assumptions where applicable.
- Backup smoke test in staging: restore latest backup to isolated DB and verify core league/draft records.
- Load smoke test for about 18 concurrent users on draft room SSE plus polling fallback headroom.
- Observability verification: logs, metrics, alerts, and correlation IDs exist for one happy path and one forced failure per critical workflow.

## Risks And Open Questions

- Choose hosting topology early enough for worker, SSE, and rate-limit design.
- Decide whether export includes keeper markers, roster slot labels, or only player/price pairs.
- Define exact draft-day backup cadence and whether pre-draft snapshot is mandatory.
- Decide RPO/RTO targets for draft night.
- Confirm whether all league members can download in-progress exports or only final exports.
- Define retention for generated exports and uploaded import files.
- Confirm whether polling fallback cadence is fixed globally or adaptive during degraded SSE behavior.
- Decide who receives draft-day operational alerts.
