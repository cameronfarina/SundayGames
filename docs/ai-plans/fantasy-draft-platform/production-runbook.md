# Fantasy Draft Platform Production Runbook

This runbook is the launch architecture for Mockd as a league-calibrated fantasy draft prep product. The first production target is one league with about 18 users, but no production decision should hard-code one league.

Domain readiness is a go/no-go gate. Do not point a public domain at Mockd until the checklist at the end of this runbook is all pass.

The concrete first-host procedure is [Render Production Launch](../../render-production-launch.md). It covers Blueprint creation, real-owner provisioning, backup rehearsal, monitoring activation, deployed smoke, and DNS cutover.

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

- `web`: HTTP app plus SSE endpoints and a persistent volume for account-isolated board and mock sessions. Run one web replica for the first release.
- `worker`: background job runner.
- `migrate`: one-off migration task before web/worker deploy.
- `scheduler`: low-frequency job enqueuer for cleanup, backup verification, and stale job checks.
- `postgres`: managed database with automated backups and PITR where possible.
- `object-storage`: uploaded import files and generated export artifacts.

Current npm entrypoints:

- `npm run platform:ready`: runs the compiled readiness CLI, verifies required migration IDs, and probes private draft storage with a flushed write and delete.
- `npm run platform:migrate`: runs the compiled migration task and applies the snapshot bridge schema plus the normalized platform schema contract with a migration ledger.
- `npm run platform:provision -- <production.json>`: idempotently provisions real accounts, one league season, memberships, teams, roster rules, the season player catalog and initial rosters, keepers, and an audit receipt. It requires Postgres. Use `--dry-run` before apply and `--verify` after apply.
- `npm run platform:web` or `npm start`: starts the compiled platform HTTP server.
- `npm run platform:worker`: starts the compiled background job worker loop.
- `npm run platform:seed:e2e`: seeds local E2E fixture users, a published season, and a live room. Use only for local or throwaway staging smoke.
- `npm run test:e2e`: starts a temporary file-backed web process and runs the Playwright platform smoke.
- `npm run test:e2e:deployed`: runs the same browser/API smoke against an already deployed base URL without starting a local server.

Build `dist` in the build stage, then prune or install production dependencies only in the runtime stage. The hosted scripts use `node`, not the development-only `tsx` package. Run `platform:ready` after migrations and before deploy. It requires Postgres-backed shared storage and an explicit persistent private-draft directory, rejects the local platform file store, verifies the migration ledger and directory write access, prints the web bind target, and lists the seed/verification, web/worker, and smoke-test steps that still need human confirmation. The web process runs the same dependency checks for `/readyz`; `/healthz` remains a process-liveness check.

The normalized schema statements are the initial schema contract. Run `platform:migrate` as a deploy step before web/worker rollout; do not rely on web startup as the production migration path. In Postgres mode, web and worker construct normalized repositories for accounts, sessions, league setup, historical imports, jobs, and private simulation runs/results while the snapshot bridge continues to carry platform areas that have not moved to first-class repositories yet. Auth-only, league-setup-only, and historical-import-only HTTP mutations skip snapshot persistence when their external repositories are configured, so those direct writes remain owned by their normalized repositories. When external auth is active, loaded snapshot auth state is scrubbed before runtime use so stale password/session hashes are not reserialized by later shared mutations.

League setup Postgres mode persists leagues, league seasons, fantasy teams, roster rule sets, and league memberships in normalized tables. The current app layer mirrors registered seasons and memberships into the in-memory store only as a compatibility bridge for existing live-room authorization and read-model code; setup route writes themselves remain owned by the league setup repository. Until the remaining legacy modules move to normalized repositories, non-setup mutations that save bridge-owned state may still serialize that mirrored league setup as compatibility data.

The first production release is scoped to the configured 14-owner Mockd auction league, owner order, roster rules, and budget. Board, mock, and simulation workspaces load the provisioned season catalog and initial rosters, then fail closed when a season uses another league shape. Supporting arbitrary league sizes or rules is a later product milestone and is not part of this launch gate.

Historical import Postgres mode persists preview batches in `historical_import_batches` and committed auction sale rows in `historical_draft_sales`. Preview row validation state is stored in the batch JSON payload until commit, then committed records are inserted inside the same repository transaction that marks the batch committed or supersedes the replaced batch. Current calibration reads join sale rows to committed batches so superseded imports remain auditable but do not feed active pricing.

HTTP auth timestamps are server-controlled. Client body/query `now` values are ignored for account creation, login, session lookup, and protected route authorization; tests and server composition inject trusted request time through the platform server clock.

## Domain Provisioning Gate

Provision these before sending public domain traffic to Mockd:

- DNS owner and deploy owner are named, with access tested.
- Hosting can run separate `web`, `worker`, and one-off `migrate` tasks from the same commit.
- Managed Postgres exists for production, with SSL required, automated backups, a confirmed PITR window, and an on-demand logical export from the provider Recovery page.
- A non-production restore target exists for rehearsals.
- Secret store has production values for the implemented runtime variables below.
- Production uses `DATABASE_URL`; `MOCKD_PLATFORM_DATA_FILE` is absent.
- A persistent volume is mounted and `MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY` points to it. The first release runs one web replica because private board/mock sessions are account-isolated files on that volume.
- `MOCKD_INITIALIZE_POSTGRES_SCHEMA` is unset or false in production.
- `MOCKD_WORKER_JOB_KINDS` is only `simulation` until more launch job kinds are implemented.
- If the worker claims `simulation`, `MOCKD_SIMULATION_DATA_MODE=local-fixtures` is set only if checked-in current-league fixture-backed simulations are accepted for launch. Otherwise, do not start a simulation worker and mark the domain gate no-go until the production simulation runner exists.
- Production league provisioning uses the reviewed `mockd.production-provisioning/v1` JSON file and `platform:provision`; `platform:seed:e2e` must not be run against production.
- Logs, error alerts, uptime checks, backup alerts, and draft-window contacts are configured.
- Domain, TLS, canonical host, and redirect behavior are verified in staging before DNS cutover.
- A rollback target exists: previous app version, current DB backup/PITR target, and DNS TTL low enough to move traffic back.

## Environment Variables

Conceptual required configuration:

- Database: `DATABASE_URL`, connection pool size, statement timeout.
- Local fallback only: `MOCKD_PLATFORM_DATA_FILE`.
- Auth/session: cookie name, session secret or signing key, session TTL, secure cookie flag.
- App URLs: public app URL, allowed origins, internal worker URL if needed.
- Proxy: explicit trusted-proxy mode when a load balancer terminates public connections.
- Storage: import bucket, export bucket, object storage credentials.
- Jobs: worker concurrency, max retries, stale lock timeout, default job timeout.
- Realtime: SSE heartbeat interval, reconnect retention window, polling fallback interval.
- Rate limits: auth, import, model run, simulation, export, draft mutation, SSE connection, polling.
- Observability: log level, error-reporting DSN, metrics endpoint/key.

Secrets belong in the hosting provider secret store. They should never be committed.

Implemented bootstrap variables:

- `DATABASE_URL`: Postgres connection string for web, worker, and migrate.
- `MOCKD_DATABASE_URL`: fallback Postgres connection string alias. Prefer `DATABASE_URL` in production.
- `HOST` / `PORT`: web bind address.
- `MOCKD_POSTGRES_POOL_SIZE`: Postgres pool size.
- `MOCKD_POSTGRES_STATEMENT_TIMEOUT_MS`: per-statement timeout passed to node-postgres.
- `MOCKD_POSTGRES_SNAPSHOT_KEY`: snapshot bridge key for shared app state during the transition to normalized repositories.
- `MOCKD_INITIALIZE_POSTGRES_SCHEMA`: dev/test convenience that initializes the platform schema during web/worker startup when a transactional Postgres client is available. Production should use `npm run platform:migrate`.
- `MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY`: persistent directory for account-isolated board, shortlist, strategy, and interactive mock sessions. Required by `platform:ready` for a domain deployment.
- `MOCKD_ALLOW_PUBLIC_SIGNUP`: defaults to `false`. Keep it unset or false in production so only invited league members can create accounts.
- `MOCKD_TRUST_PROXY`: defaults to `false`. Set it to `true` only when the web process is network-restricted behind a trusted proxy. Trusted mode prefers Cloudflare's overwritten `CF-Connecting-IP`, then supports validated standard forwarding headers for other trusted proxy deployments; malformed values fall back to the socket address. Render routes public traffic through Cloudflare and documents `CF-Connecting-IP` as the trusted client-address header.
- `MOCKD_LIVE_DRAFT_DATA_MODE`: defaults to `postgres`. Production startup and readiness reject `local-fixtures`.
- `MOCKD_PROVISIONING_TOKEN`: optional secret for deployment-only HTTP bootstrap routes. Normal production provisioning writes through `platform:provision`, so leave this unset unless an approved internal deployment workflow needs those routes.
- `MOCKD_WORKER_ID`: stable worker identifier for job locks.
- `MOCKD_WORKER_JOB_KINDS`: comma-separated job kinds the worker may claim. Defaults to `simulation` so unsupported import/pricing/export jobs are not accidentally failed.
- `MOCKD_WORKER_POLL_INTERVAL_MS`: idle/error poll delay.
- `MOCKD_WORKER_LOCK_TTL_MS`: claimed-job lock TTL.
- `MOCKD_SIMULATION_DATA_MODE`: `disabled` by default. Set `local-fixtures` only when intentionally backing simulations with the checked-in current-league fixture files. The worker refuses to start while claiming simulation jobs unless this is runnable.

Local and smoke-only variables:

- `MOCKD_E2E_DATA_FILE`: keeps the file-backed E2E store after `npm run test:e2e`.
- `MOCKD_E2E_BASE_URL` or `PLAYWRIGHT_BASE_URL`: points `npm run test:e2e:deployed` at an already-running platform web process.
- `MOCKD_E2E_DEPLOYED_COMMISSIONER_EMAIL` and `MOCKD_E2E_DEPLOYED_COMMISSIONER_PASSWORD`: credentials for a pre-provisioned owner or admin smoke account.
- `MOCKD_E2E_DEPLOYED_MEMBER_EMAIL` and `MOCKD_E2E_DEPLOYED_MEMBER_PASSWORD`: credentials for a pre-provisioned member smoke account.
- `MOCKD_E2E_DEPLOYED_SEASON_ID`: a dedicated published smoke season with both accounts assigned to teams, stored catalog and keeper data, and no existing real draft room.
- `MOCKD_E2E_RUN_ID`, `MOCKD_E2E_PASSWORD`, `MOCKD_E2E_EMAIL_DOMAIN`, and `MOCKD_E2E_PROVISIONING_TOKEN`: local fixture bootstrap controls. The deployed runner rejects them.
- `MOCKD_LIVE_DRAFT_DIR`: local `npm run draft:ui` session directory, not hosted platform storage.

Optional read-only provider variables:

- Yahoo: `MOCKD_YAHOO_CLIENT_ID`, `MOCKD_YAHOO_CLIENT_SECRET`, and optional `MOCKD_YAHOO_REDIRECT_URI`.
- ESPN local testing: `MOCKD_ESPN_LEAGUE_ID`, `MOCKD_ESPN_SWID`, `MOCKD_ESPN_S2`.
- These are not domain blockers unless the launch explicitly includes provider sync. ESPN import/writeback is not a launch dependency.

Production variables still missing from code:

- No implemented public app URL, allowed-origin, cookie-domain, object-storage, rate-limit tuning, metrics, or alert env names exist yet. Auth endpoints have bounded in-process email and client-address limits; keep one web replica for the first release and add shared edge limits before scaling horizontally. If the chosen host requires any missing setting to make the public domain safe, domain readiness is no-go until code exposes and verifies it.

## Migrate, Seed, And Smoke

Run these against the exact commit that will serve the domain.

1. Build the production artifact and remove development dependencies:

   ```bash
   npm ci
   npm run build
   npm test
   npm prune --omit=dev
   ```

   A multi-stage image may instead copy `dist`, `package.json`, and `package-lock.json` into the runtime stage before running `npm ci --omit=dev`.

2. Apply migrations before web/worker rollout:

   ```bash
   DATABASE_URL="$PRODUCTION_DATABASE_URL" npm run platform:migrate
   ```

   Expected output is `Applied N platform migration statements.` A repeat run should be safe and can print `Applied 0 platform migration statements.`

3. Check production/domain runtime readiness:

   ```bash
   HOST=0.0.0.0 PORT="$PORT" DATABASE_URL="$PRODUCTION_DATABASE_URL" MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY=/var/lib/mockd/draft-tools npm run platform:ready
   ```

   This preflight checks runtime config, Postgres connectivity, required migration IDs, and writable private draft storage. The human checklist below still gates backups, seed data, DNS, smoke, and rollback.

4. Seed or verify data:

   - Production provisioning is a reviewed, declarative operation. Keep the JSON file outside fixture/E2E directories, keep password hashes in the secret store, and run:

     ```bash
     DATABASE_URL="$PRODUCTION_DATABASE_URL" npm run platform:provision -- /secure/mockd-production-2026.json --dry-run
     DATABASE_URL="$PRODUCTION_DATABASE_URL" npm run platform:provision -- /secure/mockd-production-2026.json
     DATABASE_URL="$PRODUCTION_DATABASE_URL" npm run platform:provision -- /secure/mockd-production-2026.json --verify
     ```

     All three commands require the password-hash environment variables referenced by the JSON file. The apply is safe to rerun with the same file and secret values: matching records and the deterministic `audit_events` receipt are unchanged. Existing records with different content are conflicts. If an audit receipt exists but provisioned state has drifted, apply stops and requires investigation. The command never deletes production records.

     The input contract is:

     ```json
     {
       "schemaVersion": "mockd.production-provisioning/v1",
       "provisioningId": "mockd-2026-launch",
       "environment": "production",
       "actorAccountId": "account-cam",
       "accounts": [
         {
           "id": "account-cam",
           "email": "cam@example.com",
           "passwordHashEnv": "MOCKD_PROVISION_CAM_PASSWORD_HASH"
         }
       ],
       "league": {
         "id": "league-real-123",
         "externalLeagueId": "123",
         "name": "Real Auction League",
         "provider": "yahoo"
       },
       "memberships": [
         {
           "accountId": "account-cam",
           "role": "owner",
           "ownerId": "owner-cam",
           "teamId": "team-cam"
         }
       ],
       "season": {
         "id": "season-real-2026",
         "year": 2026,
         "status": "published",
         "draft": {
           "scheduledAt": "2026-08-29T23:00:00.000Z",
           "timezone": "America/New_York"
         },
         "settings": {
           "auction": { "budgetDollars": 200, "minimumBidDollars": 1 },
           "roster": {
             "rosterSize": 2,
             "lineup": { "QB": 1, "RB": 1 },
             "rosterMaximums": { "QB": 2, "RB": 2, "WR": 2, "TE": 2, "K": 1, "DST": 1 }
           },
           "keeperPolicy": {
             "mode": "previous-cost-multiplier",
             "multiplier": 1.2,
             "rounding": "ceil"
           }
         },
         "teams": [
           {
             "id": "team-cam",
             "ownerId": "owner-cam",
             "ownerDisplayName": "Cam",
             "name": "Sunday Scaries",
             "draftOrderPosition": 1
           }
         ]
       },
       "catalog": [
         {
           "playerId": "player-jalen-hurts",
           "name": "Jalen Hurts",
           "position": "QB",
           "expectedPrice": 24,
           "provider": "yahoo",
           "providerPlayerId": "30123",
           "teamAbbreviation": "PHI",
           "byeWeek": 9
         }
       ],
       "initialRosters": [
         {
           "teamId": "team-cam",
           "playerId": "player-jalen-hurts",
           "price": 18,
           "source": "keeper"
         }
       ],
       "keepers": [
         {
           "id": "keeper-cam-hurts-2026",
           "teamId": "team-cam",
           "playerId": "player-jalen-hurts",
           "keeperCost": 18,
           "previousCost": 15,
           "status": "published",
           "source": "commissioner"
         }
       ]
     }
     ```

     Use the exact configured 14-owner order and current Mockd settings plus all real teams and catalog players; the one-team example only shows field names. Account emails and IDs must be unique. `actorAccountId` must have an owner or admin membership. Membership team/owner IDs, initial rosters, and keepers must reference records in the same document. Active/published keepers must match a `source: "keeper"` initial-roster row and price. `provisioningId` becomes the immutable source version for `league_season_draft_setups`. The command rejects fixture paths and known local E2E identifiers even if the document says `production`.

     The command covers the normalized account, league setup, `players`, `keeper_declarations`, `league_season_draft_setups`, and `audit_events` records. Continue to use the approved admin/UI/API path for historical imports and the active pricing snapshot, then verify both before launch.

   - Local or throwaway staging only:

     ```bash
     MOCKD_PLATFORM_DATA_FILE=/tmp/mockd-platform-store.json npm run platform:seed:e2e
     ```

     or, for a throwaway Postgres rehearsal:

     ```bash
     DATABASE_URL="$STAGING_DATABASE_URL" npm run platform:seed:e2e
     ```

5. Start runtime processes:

   ```bash
   HOST=0.0.0.0 PORT="$PORT" DATABASE_URL="$PRODUCTION_DATABASE_URL" MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY=/var/lib/mockd/draft-tools npm run platform:web
   DATABASE_URL="$PRODUCTION_DATABASE_URL" MOCKD_SIMULATION_DATA_MODE=local-fixtures npm run platform:worker
   ```

6. Run smoke:

   ```bash
   npm run qa -- --scenarios=expected --runs=2 --seed-prefix=domain-smoke
   npm run draft:ready -- --owner=Cam --strategy=three-rb --scenario=expected --runs=50 --qa-runs=2 --strategy-mode=force --seed-prefix=domain-ready
   npx playwright install chromium
   npm run test:e2e
   ```

   For staging with a running web process:

   ```bash
   export MOCKD_E2E_DEPLOYED_COMMISSIONER_EMAIL=commissioner-smoke@example.com
   export MOCKD_E2E_DEPLOYED_COMMISSIONER_PASSWORD="$SMOKE_COMMISSIONER_PASSWORD"
   export MOCKD_E2E_DEPLOYED_MEMBER_EMAIL=member-smoke@example.com
   export MOCKD_E2E_DEPLOYED_MEMBER_PASSWORD="$SMOKE_MEMBER_PASSWORD"
   export MOCKD_E2E_DEPLOYED_SEASON_ID=mockd-release-smoke-2026
   npm run test:e2e:deployed -- --base-url=https://staging.example.com
   ```

   Provision the smoke accounts and season with the reviewed production provisioning command before the run. The commissioner must have owner or admin access, both accounts must have distinct assigned teams, and the season must include its stored draft setup without an existing real room. The deployed runner refuses local fixture bootstrap variables, signs in through invite-only auth, and uses only normal authenticated product actions. It creates, starts, mutates, ends, and exports the dedicated room, so provision a fresh smoke season before every run. No public signup or HTTP provisioning token is required.

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
- Daily backup or snapshot of `MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY` so private board and mock sessions can be restored with the release.

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

Required rehearsal before domain cutover:

1. Create a fresh non-production database.
2. Apply migrations with `DATABASE_URL="$RESTORE_TEST_DATABASE_URL" npm run platform:migrate`.
3. Seed representative throwaway data with `DATABASE_URL="$RESTORE_TEST_DATABASE_URL" npm run platform:seed:e2e` or restore the latest staging backup.
4. If the source database accepts smoke records, run `npm run test:e2e:deployed -- --base-url="$SOURCE_APP_URL"` before backup so the backup includes live-room events and an export artifact. Otherwise, manually create and export a test room.
5. Run the verification SQL below against the source database and save the counts.
6. Take a manual backup of that source database and record its backup ID.
7. Restore that backup into a second isolated database.
8. Run the same SQL against the restored database. Counts must match the source counts unless the difference is explained.
9. Start web against the restored database. Log in with a restored test account, such as `cam@mockd.local` / `mockd local e2e password` from `platform:seed:e2e`, open the restored room, and read/download the export artifact.
10. Record backup ID, restore target, started/finished timestamps, verification counts, browser result, owner, and any data loss.

Verification SQL:

```sql
select 'platform_schema_migrations' as table_name, count(*) from platform_schema_migrations
union all select 'accounts', count(*) from accounts
union all select 'sessions', count(*) from sessions
union all select 'leagues', count(*) from leagues
union all select 'league_memberships', count(*) from league_memberships
union all select 'league_seasons', count(*) from league_seasons
union all select 'fantasy_teams', count(*) from fantasy_teams
union all select 'players', count(*) from players
union all select 'keeper_declarations', count(*) from keeper_declarations
union all select 'league_season_draft_setups', count(*) from league_season_draft_setups
union all select 'historical_import_batches', count(*) from historical_import_batches
union all select 'historical_draft_sales', count(*) from historical_draft_sales
union all select 'pricing_snapshots', count(*) from pricing_snapshots
union all select 'jobs', count(*) from jobs
union all select 'simulation_runs', count(*) from simulation_runs
union all select 'draft_rooms', count(*) from draft_rooms
union all select 'draft_room_events', count(*) from draft_room_events
union all select 'draft_room_exports', count(*) from draft_room_exports
union all select 'draft_room_export_contents', count(*) from draft_room_export_contents
union all select 'audit_events', count(*) from audit_events;
```

Restore rehearsal passes only when migrations are present, source/restored counts match, browser read/export smoke passes, and generated export content can be read from the restored database. Do not rerun the deployed smoke against preserved restored data unless new smoke records are approved for that database.

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

Run the mutation-heavy checks against an isolated rehearsal deployment and database created from the reviewed provisioning document. Never create a disposable room or log test sales in the real production season. After the isolated rehearsal passes, run the read-only deployed smoke with commissioner and member accounts against production.

- Before distributing launch passwords, run `platform:provision --verify` for the reviewed production file and confirm the league, accounts, memberships, teams, rules, catalog, initial rosters, keepers, and audit receipt all match. Do not rerun immutable credential provisioning after an owner changes or resets a password.
- Import at least one historical draft sheet and verify totals.
- Publish a pricing snapshot.
- Create a test live room.
- Connect commissioner plus at least two member browsers.
- Log sales with command forms such as `cam puka 62` and natural forms such as `Cam took Puka for 62`.
- Verify roster max errors, budget errors, undo, correction, SSE reconnect, and polling fallback.
- Generate the one-sheet export and compare against the room rosters.
- Record a pre-draft PITR timestamp, create/download a logical database export, and confirm the latest web-disk snapshot.
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

Mark every item pass before pointing the domain. Any fail is no-go.

| Area | Go condition |
| --- | --- |
| Domain | DNS owner, deploy owner, TLS, canonical host, redirects, and rollback TTL are verified in staging. |
| Deploy | `npm run build`, `npm test`, `npm run test:e2e`, and staging `npm run test:e2e:deployed -- --base-url=...` pass on the release commit. |
| Migrations | `DATABASE_URL="$PRODUCTION_DATABASE_URL" npm run platform:migrate` completed before web/worker rollout, repeat-run output is safe, and `league_season_draft_setups` exists. |
| Runtime env | `npm run platform:ready` passes with production env; production has `DATABASE_URL`, correct `HOST`/`PORT`, Postgres pool/timeout settings, worker settings, `MOCKD_LIVE_DRAFT_DATA_MODE=postgres`, invite-only signup, a persistent `MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY`, and no `MOCKD_PLATFORM_DATA_FILE` or startup schema init. |
| Seed data | `platform:provision --verify` passes for the reviewed real-data file; historical imports and an active pricing snapshot also exist; no `platform:seed:e2e` fixture accounts are present in production. |
| Worker | Worker starts, claims only supported job kinds, and does not run simulation jobs unless the fixture-backed launch constraint is accepted. |
| Realtime | SSE stream and `events?afterRevision=N` polling fallback both recover a sale in staging. |
| Draft commands | Sale, undo, end, idempotency, stale revision, budget, roster, and position maximum validation pass in staging. |
| Export | Final export artifact is created after room end and content is readable after restore. |
| Backups | Automated backups and alerts are enabled, the pre-cutover UTC recovery point and logical export are recorded, and restore rehearsal has passed within 7 days. |
| Monitoring | Uptime, 5xx, Postgres availability, queue stall, backup failure, and draft-window mutation alerts route to named owners. |
| Provider risk | Yahoo/ESPN sync is either disabled or read-only configured. ESPN cookies are not collected in hosted production. |
| Degraded mode | Manual draft board fallback, recovery owner, and user comms are ready for draft night. |
