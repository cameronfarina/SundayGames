# Fantasy Draft Platform Production Runbook

This runbook is the launch architecture for Mockd as a league-calibrated fantasy draft prep product. The first production target is one league with about 18 users, but no production decision should hard-code one league.

## Production Topology

- Web/API process:
  - Serves the authenticated app, API routes, live draft reads/writes, SSE streams, and polling fallback.
  - Uses secure HttpOnly cookies for sessions.
  - Performs all membership, role, and privacy checks server-side.
- Worker process:
  - Runs historical imports, player resolution tasks, pricing/model runs, private simulations, exports, cleanup, and scheduled checks.
  - Claims jobs from Postgres with row locks and idempotency keys.
- Postgres:
  - Source of truth for accounts, leagues, shared league state, private prep, live draft events/projections, jobs, and exports.
  - Browser `localStorage` is only for harmless UI preferences.
- Optional cache later:
  - Redis or similar can be added for rate-limit counters, SSE fanout coordination, or high-volume dispatch.
  - It is not the source of truth.

## Local Dev Topology

- One local web server for app/API traffic.
- One local worker process for jobs.
- One local Postgres database.
- File imports and generated exports can use local disk in dev, but production should use durable object storage.
- Seed data should include the current Mockd league, teams, keepers, rules, one pricing snapshot, and at least one live draft room fixture.

## Deploy Units

- `web`: stateless HTTP app plus SSE endpoints.
- `worker`: background job runner.
- `migrate`: one-off migration task before web/worker deploy.
- `scheduler`: low-frequency job enqueuer for cleanup, backup verification, and stale job checks.
- `postgres`: managed database with automated backups and PITR where possible.
- `object-storage`: uploaded import files and generated export artifacts.

Current npm entrypoints:

- `npm run platform:migrate`: applies the snapshot bridge schema plus the normalized platform schema contract with a migration ledger.
- `npm run platform:web`: starts the platform HTTP server.
- `npm run platform:worker`: starts the background job worker loop.

The normalized schema statements are the initial schema contract. Run `platform:migrate` as a deploy step before web/worker rollout; do not rely on web startup as the production migration path.

## Environment Variables

Conceptual required configuration:

- Database: `DATABASE_URL`, connection pool size, statement timeout.
- Local fallback only: `MOCKD_PLATFORM_DATA_FILE`.
- Auth/session: cookie name, session secret or signing key, session TTL, secure cookie flag.
- App URLs: public app URL, allowed origins, internal worker URL if needed.
- Storage: import bucket, export bucket, object storage credentials.
- Jobs: worker concurrency, max retries, stale lock timeout, default job timeout.
- Realtime: SSE heartbeat interval, reconnect retention window, polling fallback interval.
- Rate limits: auth, import, model run, simulation, export, draft mutation, SSE connection, polling.
- Observability: log level, error-reporting DSN, metrics endpoint/key.

Secrets belong in the hosting provider secret store. They should never be committed.

Implemented bootstrap variables:

- `DATABASE_URL`: Postgres connection string for web, worker, and migrate.
- `HOST` / `PORT`: web bind address.
- `MOCKD_POSTGRES_POOL_SIZE`: Postgres pool size.
- `MOCKD_POSTGRES_STATEMENT_TIMEOUT_MS`: per-statement timeout passed to node-postgres.
- `MOCKD_POSTGRES_SNAPSHOT_KEY`: snapshot bridge key for shared app state during the transition to normalized repositories.
- `MOCKD_INITIALIZE_POSTGRES_SCHEMA`: dev/test convenience that initializes only the snapshot bridge table during web/worker startup. Production should use `npm run platform:migrate`.
- `MOCKD_WORKER_ID`: stable worker identifier for job locks.
- `MOCKD_WORKER_JOB_KINDS`: comma-separated job kinds the worker may claim. Defaults to `simulation` so unsupported import/pricing/export jobs are not accidentally failed.
- `MOCKD_WORKER_POLL_INTERVAL_MS`: idle/error poll delay.
- `MOCKD_WORKER_LOCK_TTL_MS`: claimed-job lock TTL.
- `MOCKD_SIMULATION_DATA_MODE`: `disabled` by default. Set `local-fixtures` only when intentionally backing simulations with the checked-in current-league fixture files. The worker refuses to start while claiming simulation jobs unless this is runnable.

## Realtime Decision

Use SSE with polling fallback for the live draft room.

Why SSE fits:

- Draft night is read-heavy and write-light. The commissioner submits normal authenticated `POST` mutations, and everyone else mostly watches.
- The server can send ordered room events with a monotonic `revision`.
- Browsers reconnect SSE automatically, and the app can resume from `Last-Event-ID`.
- SSE is simpler to operate than WebSockets for one-way room updates.
- Load for the launch room is small, but the event/revision model scales cleanly to more rooms.

Why not WebSockets at launch:

- We do not need bidirectional low-latency collaboration.
- WebSockets add more connection lifecycle, auth refresh, fanout, and deployment complexity.
- Normal `POST` writes keep commissioner actions idempotent, auditable, and easy to retry.

Polling fallback:

- `GET /events?afterRevision=N` reads the same Postgres event stream.
- It is only a fallback or stale-client recovery path.
- It must never become a second write path.

## Offline Live Draft Flow

- Commissioner prepares league settings, teams, owners, keepers, and historical imports before draft day.
- Commissioner publishes the league season and active pricing snapshot.
- Commissioner creates a live auction room from that published season.
- League members log in, open the room, and select the team they want to view.
- Commissioner logs sales with fast commands like `cam puka 62`.
- Each sale runs validation, appends a draft event, updates projections, increments `revision`, and broadcasts over SSE.
- Board, rosters, budgets, max bid, team errors, sale log, and export state all read from Postgres-backed projections.
- Draft end freezes the final room state and allows final export generation.

## ESPN Reality

ESPN import/writeback is not a launch dependency.

- ESPN league data may be private, inconsistent, or unavailable without user cookies/API behavior we should not rely on.
- Commissioner setup must be possible without ESPN.
- Historical league data comes from uploaded CSV/XLSX sheets.
- Final ESPN roster entry is manual.
- Mockd export is one sheet for manual entry/reference: team columns with selected players and prices.

## Backup And Restore

Backup expectations:

- Automated daily full Postgres backups.
- Point-in-time recovery if the provider supports WAL/PITR.
- Manual pre-draft snapshot on draft day.
- Manual pre-migration snapshot for risky changes.
- Durable storage backups for uploaded imports and generated exports.

Restore expectations:

- Restore to an isolated database first.
- Verify users, leagues, memberships, league seasons, keepers, imports, model runs, live rooms, draft events, jobs, and exports.
- Rebuild projection tables from authoritative events if needed.
- Promote restored data or selectively copy repaired records.
- Invalidate sessions if auth/session integrity is uncertain.
- Regenerate exports from committed draft state.

Launch targets:

- Normal RPO: 24 hours.
- Draft-day RPO: pre-draft snapshot plus provider PITR if available.
- RTO: hours, with a documented manual degraded mode during the draft.

## Monitoring And Alerts

Structured logs should include request ID, user ID when available, league ID, season ID, room ID, job ID, idempotency key, and revision where relevant. Never log passwords, raw session tokens, cookies, or full private strategy prompts.

Metrics:

- Request latency and 5xx rate by route.
- Auth failures and rate-limit hits.
- Active SSE connections, reconnect rate, heartbeat failures, polling fallback rate.
- Draft mutation latency, validation failures, stale revision conflicts.
- Worker queue depth, job duration, retries, dead jobs, canceled jobs.
- Import, model run, simulation, and export success/failure counts.
- Postgres connection usage, slow queries, backup success/failure.

Alerts:

- App unavailable or elevated 5xx.
- Postgres unavailable or pool exhaustion.
- Backup failure.
- Worker queue stalled.
- Repeated import/model/simulation/export failures.
- Live draft mutation failures during a scheduled draft window.
- SSE reconnect/fallback spike during draft night.

## Draft-Night Rehearsal

Run this before the real draft:

- Seed or verify the production league, users, memberships, teams, owners, settings, keepers, and draft date.
- Import at least one historical draft sheet and verify totals.
- Publish a pricing snapshot.
- Create a test live room.
- Connect commissioner plus at least two member browsers.
- Log sales with command forms such as `cam puka 62` and natural forms such as `Cam took Puka for 62`.
- Verify roster max errors, budget errors, undo, correction, SSE reconnect, and polling fallback.
- Generate the one-sheet export and compare against the room rosters.
- Take a pre-draft backup snapshot.
- Confirm incident contacts and the degraded-mode procedure.

## Incident And Degraded Mode

If SSE fails:

- Keep normal `POST` mutations active.
- Switch clients to polling fallback with `afterRevision`.
- Show a visible degraded realtime banner.

If workers fail:

- Live draft sale logging can continue because it is synchronous Postgres mutation plus projection.
- Imports, simulations, model runs, and exports may pause.
- Restart workers and retry failed jobs from Postgres.

If export fails:

- Keep the final draft state in Postgres.
- Retry export generation.
- In worst case, use the live room roster projection as a manual reference until export is restored.

If Postgres fails during draft:

- Stop accepting live mutations.
- Communicate that Mockd is paused.
- Continue the in-person sticker board as source of truth.
- After recovery, commissioner backfills sales through import commands.

If a commissioner enters a bad sale:

- Use undo for the latest reversible sale.
- Use correction for older mistakes.
- Do not delete authoritative events.

## Launch Readiness Checklist

- Accounts and sessions are production-safe.
- League membership and privacy checks pass for shared and private routes.
- Postgres migrations are applied.
- Backups are enabled and one restore has been rehearsed.
- Worker queue is running.
- SSE and polling fallback are tested.
- Draft command validation covers owner, player, price, budget, roster, position maximums, idempotency, and stale revision.
- ESPN is not required for setup or finalization.
- Export produces one sheet for manual ESPN roster entry/reference.
