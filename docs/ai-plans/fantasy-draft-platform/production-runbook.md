# Fantasy Draft Platform Production Runbook

This runbook is the launch architecture for Mockd as a league-calibrated fantasy draft prep product. The first production target is one league with about 18 users, but no production decision should hard-code one league.

Domain readiness is a go/no-go gate. Do not point a public domain at Mockd until the checklist at the end of this runbook is all pass.

The concrete first-host procedure is [Render Production Launch](../../render-production-launch.md). It covers Blueprint creation, commissioner-led product setup, backup rehearsal, monitoring activation, deployed smoke, and DNS cutover.

## Production Topology

- Web/API process:
  - Serves the authenticated app, API routes, live draft reads/writes, SSE streams, and polling fallback.
  - Uses secure HttpOnly cookies for sessions.
  - Performs all membership, role, and privacy checks server-side.
- Interactive simulation execution:
  - Atomically persists a private simulation run and versioned `season_simulation` job in Postgres.
  - Admits at most one active season batch per account and claims fairly across accounts.
  - Executes auction and snake 1-100 run batches in a dedicated worker with attempt-fenced completion.
  - Reports durable progress through bounded, reconnectable SSE observation windows.
- Postgres:
  - Source of truth for accounts, leagues, shared league state, private prep, live draft events/projections, jobs, and exports.
  - Browser `localStorage` is only for harmless UI preferences.
- Optional cache later:
  - Redis or similar can be added for rate-limit counters, SSE fanout coordination, or high-volume dispatch.
  - It is not the source of truth.

## Local Dev Topology

- One local web server for app/API traffic.
- One local Postgres database.
- File imports and generated exports can use local disk in dev, but production should use durable object storage.
- Local E2E seed data should include a representative league, teams, keepers, rules, one pricing snapshot, and at least one live draft room fixture.

## Deploy Units

- `web`: HTTP app plus SSE endpoints, with a container-local scratch directory for account-isolated classic draft-tools artifacts. Durable unified mock sessions use normalized Postgres session and event tables; the compatibility platform store carries shared areas that have not moved yet. Run one web replica, and attach no disk, so Render can deploy without downtime.
- `worker`: one Render Starter background worker that claims only versioned `season_simulation` jobs. This is the only new paid deploy unit; Starter begins at $7/month and active time is prorated.
- `migrate`: one-off migration task before the web deploy.
- `postgres`: managed database with automated backups and PITR where possible.
- Future scale units, not part of the first release: a scheduler, additional workers, and object storage.

Current npm entrypoints:

- `npm run platform:ready`: runs the compiled readiness CLI, verifies required migration IDs, and probes private draft storage with a flushed write and delete.
- `npm run platform:migrate`: runs the compiled migration task and applies the snapshot bridge schema plus the normalized platform schema contract with a migration ledger.
- `npm run platform:provision -- <production.json>`: optional operator recovery/import path for an externally reviewed environment snapshot. Normal league creation and setup happen in the product.
- `npm run platform:web` or `npm start`: starts the compiled platform HTTP server.
- `npm run platform:worker`: starts the durable simulation worker. Production sets `MOCKD_WORKER_JOB_KINDS=season_simulation`.
- `npm run platform:seed:e2e`: seeds local E2E fixture users, a published season, and a live room. Use only for local or throwaway staging smoke.
- `npm run test:e2e`: starts a temporary file-backed web process and runs the Playwright platform smoke.
- `npm run test:e2e:deployed`: runs the same browser/API smoke against an already deployed base URL without starting a local server.

Build `dist` in the build stage, then prune or install production dependencies only in the runtime stage. The hosted scripts use `node`, not the development-only `tsx` package. Run `platform:ready` after migrations and before deploy. It requires Postgres-backed shared storage and an explicit persistent private-draft directory, rejects the local platform file store, verifies the migration ledger and directory write access, prints the web bind target, and lists the setup, web, and smoke-test steps that still need human confirmation. The web process runs the same dependency checks for `/readyz`; `/healthz` remains a process-liveness check.

The normalized schema statements are the initial schema contract. Run `platform:migrate` as a deploy step before the web rollout; do not rely on web startup as the production migration path. In Postgres mode, the web process constructs normalized repositories for accounts, sessions, league setup, historical imports, jobs, private simulation runs/results, practice shortlists, and unified mock sessions while the snapshot bridge continues to carry platform areas that have not moved to first-class repositories yet. Auth-only, league-setup-only, and historical-import-only HTTP mutations skip snapshot persistence when their external repositories are configured, so those direct writes remain owned by their normalized repositories. When external auth is active, loaded snapshot auth state is scrubbed before runtime use so stale password/session hashes are not reserialized by later shared mutations.

League setup Postgres mode persists leagues, league seasons, fantasy teams, roster rule sets, and league memberships in normalized tables. Provider imports register the season and link its league connection in one transaction, so a failed link cannot leave an orphaned league. The current app layer mirrors registered seasons and memberships into the in-memory store only as a compatibility bridge for existing live-room authorization and read-model code; setup route writes themselves remain owned by the league setup repository. Until the remaining legacy modules move to normalized repositories, non-setup mutations that save bridge-owned state may still serialize that mirrored league setup as compatibility data.

Postgres request admission gives reads shared snapshot access and reserves exclusive access for snapshot-backed mutations, draft transactions, and compatibility-mirror changes. Connected-league discovery and provider fetches, including the conditional refresh before an import, run outside snapshot admission when their normalized repositories are active. Migration `platform-league-sync-revisions-v23` adds an integer claim to each connection and stored snapshot; every sync claims the next revision before provider I/O, so slow or equal-time responses cannot replace a later request. Player-directory writes reject older or equal fetch times. Sync and import re-enter exclusive access only while refreshing or linking the Sunday Games season. They reload the current link and snapshot after each write and retry a bounded number of times if another process wins; continued churn returns a retryable conflict and releases admission instead of claiming convergence or holding unrelated reads indefinitely.

The board, interactive mock engines, and hosted real draft rooms support auction and snake leagues with 4 to 20 teams, league-specific roster rules, keepers, and values. Snake rooms follow the commissioner-edited team order, reverse even rounds, skip keeper slots, and let only the manager on the clock make their own pick. Historical auction imports feed calibrated pricing; historical snake draft calibration is not yet available and the product must say so explicitly. Do not advertise historical snake calibration until its production checks pass.

Historical import Postgres mode persists preview batches in `historical_import_batches` and committed auction sale rows in `historical_draft_sales`. Preview row validation state is stored in the batch JSON payload until commit, then committed records are inserted inside the same repository transaction that marks the batch committed or supersedes the replaced batch. Current calibration reads join sale rows to committed batches so superseded imports remain auditable but do not feed active pricing.

HTTP auth timestamps are server-controlled. Client body/query `now` values are ignored for account creation, login, session lookup, and protected route authorization; tests and server composition inject trusted request time through the platform server clock.

Signup, verification-resend, and password-reset requests persist or replace their
single-use token before starting best-effort email delivery. Their generic HTTP
response does not wait for Resend, so account state and provider failures do not
change the response. Delivery failures emit only the structured
`auth_email_delivery_failed` event and token purpose; logs omit the address,
token, action URL, and provider error. Authentication email has no durable
outbox in the first production topology. A web-process stop after token commit
can therefore lose that delivery attempt, and the user must submit the request
again to create and send a replacement token.

## Domain Readiness Gate

Complete these before sending public domain traffic to Mockd:

- DNS owner and deploy owner are named, with access tested.
- Hosting can run the `web`, Starter `worker`, and one-off `migrate` task from the same commit.
- Managed Postgres exists for production, with SSL required, automated backups, a confirmed PITR window, and an on-demand logical export from the provider Recovery page.
- A non-production restore target exists for rehearsals.
- Secret store has production values for the implemented runtime variables below.
- Production uses `DATABASE_URL`; `MOCKD_PLATFORM_DATA_FILE` is absent.
- `MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY` points to a writable container-local directory, and no persistent disk is attached. A disk would cost zero-downtime deploys. The release runs one web replica because the classic draft-tools sessions are account-isolated files held by that instance.
- `MOCKD_INITIALIZE_POSTGRES_SCHEMA` is unset or false in production.
- `MOCKD_ALLOW_PUBLIC_SIGNUP=true` so users can create accounts and commissioners can create leagues through the product.
- `MOCKD_AUTH_EMAIL_MODE=resend`, `RESEND_API_KEY`, `MOCKD_EMAIL_FROM`, and `MOCKD_PUBLIC_BASE_URL` are configured so account ownership and recovery require mailbox proof.
- Production leagues are created and configured through the reviewed in-product flow; `platform:seed:e2e` must not be run against production.
- Logs, error alerts, uptime checks, backup alerts, and draft-window contacts are configured.
- Domain, TLS, canonical host, and redirect behavior are verified in staging before DNS cutover.
- A rollback target exists: previous app version, current DB backup/PITR target, and DNS TTL low enough to move traffic back.

## Environment Variables

Conceptual required configuration:

- Database: `DATABASE_URL`, connection pool size, statement timeout.
- Local fallback only: `MOCKD_PLATFORM_DATA_FILE`.
- Auth/session: cookie name, session secret or signing key, session TTL, secure cookie flag.
- App URLs: public app URL and allowed origins.
- Proxy: explicit trusted-proxy mode when a load balancer terminates public connections.
- Storage: import bucket, export bucket, object storage credentials.
- Asynchronous jobs: worker identity, accepted versioned job kinds, retry limit, stale-lock timeout, heartbeat age, queue depth, and oldest queued age.
- Realtime: SSE heartbeat interval, reconnect retention window, polling fallback interval.
- Rate limits: auth, import, model run, simulation, export, draft mutation, SSE connection, polling.
- Observability: log level, error-reporting DSN, metrics endpoint/key.

Secrets belong in the hosting provider secret store. They should never be committed.

Implemented bootstrap variables:

- `DATABASE_URL`: Postgres connection string for web and migrate.
- `MOCKD_DATABASE_URL`: fallback Postgres connection string alias. Prefer `DATABASE_URL` in production.
- `HOST` / `PORT`: web bind address.
- `MOCKD_POSTGRES_POOL_SIZE`: Postgres pool size.
- `MOCKD_POSTGRES_STATEMENT_TIMEOUT_MS`: per-statement timeout passed to node-postgres.
- `MOCKD_POSTGRES_SNAPSHOT_KEY`: snapshot bridge key for shared app state during the transition to normalized repositories.
- `MOCKD_PRACTICE_PERSISTENCE_MODE`: defaults to `dual-write`. Keep that mode for the first v25 deployment so normalized mock writes remain visible to the old snapshot process. Each v25 dual write commits its normalized change and compatibility snapshot CAS in one transaction. Change it to `normalized-only` only after every pre-v25 process and in-flight request has drained. The normalized-only startup disables the database bridge and scrubs compatibility mock sessions; later stale snapshot writes that carry mock sessions are rejected, and `/readyz` also requires the scrub invariant. Returning to dual-write after that boundary requires restoring the pre-cutover database recovery point.
- `MOCKD_INITIALIZE_POSTGRES_SCHEMA`: dev/test convenience that initializes the platform schema during web startup when a transactional Postgres client is available. Production should use `npm run platform:migrate`.
- `MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY`: writable scratch directory for the classic draft-tools board, shortlist, strategy, and interactive mock sessions, which the current app reaches only through the `/api/*` routes. Required by `platform:ready` for a domain deployment. It does not need to survive a restart, and it must not be a Render disk.
- `MOCKD_ALLOW_PUBLIC_SIGNUP`: defaults to `false`. Set it to `true` for the public Mockd product so a signed-in user can create or join a league. Account-creation rate limits remain mandatory; invitations still bind invited managers to league teams.
- `MOCKD_AUTH_EMAIL_MODE`: defaults to `auto-verify` for local development. Production requires `resend`.
- `RESEND_API_KEY`: production Resend API credential. It is sent only in the HTTPS authorization header.
- `MOCKD_EMAIL_FROM`: verified Resend sender, such as `Mockd <accounts@example.com>`.
- `MOCKD_PUBLIC_BASE_URL`: public HTTPS origin used for verification and reset links. It must not contain a path, query, or fragment.
- `MOCKD_LEAGUE_CONNECTION_CREDENTIAL_ACTIVE_KEY_ID`: the key id used for new ESPN credential envelopes. Use a date- or release-based id containing only letters, digits, dots, underscores, or hyphens.
- `MOCKD_LEAGUE_CONNECTION_CREDENTIAL_KEYS`: a secret-store-only JSON object from key id to canonical base64-encoded 32-byte key. Generate each value with `openssl rand -base64 32`. Keep retired keys in this object until the rotation query below reports no rows for them. The keyring is not stored in Postgres or included in database backups.
- `MOCKD_TRUST_PROXY`: defaults to `false`. Set it to `true` only when the web process is network-restricted behind a trusted proxy. Trusted mode prefers Cloudflare's overwritten `CF-Connecting-IP`, then supports validated standard forwarding headers for other trusted proxy deployments; malformed values fall back to the socket address. Render routes public traffic through Cloudflare and documents `CF-Connecting-IP` as the trusted client-address header.
- `MOCKD_LIVE_DRAFT_DATA_MODE`: defaults to `postgres`. Production startup and readiness reject `local-fixtures`.
- `MOCKD_PROVISIONING_TOKEN`: optional secret for deployment-only HTTP bootstrap routes. Normal production setup happens in the product, so leave this unset unless an approved recovery workflow needs those routes.
- `MOCKD_WORKER_ID`, `MOCKD_WORKER_JOB_KINDS`, `MOCKD_WORKER_POLL_INTERVAL_MS`, and `MOCKD_WORKER_LOCK_TTL_MS`: durable worker controls. The production worker sets `MOCKD_WORKER_JOB_KINDS=season_simulation`; web leaves them unset.
- `MOCKD_SEASON_SIMULATION_PRODUCER_ENABLED`: rolling-deploy gate for the web producer. Keep it false for the first decoder-compatible web deploy; set it true only after its old predecessor is deactivated and a compatible worker heartbeat is current.
- `MOCKD_SIMULATION_DATA_MODE`: legacy fixture-runner switch. Keep it `disabled` in production; league-aware interactive simulations do not use it.
- `MOCKD_ENABLE_LEGACY_MOCK_BATCH`: local-only opt-in for the retired `/api/mock-batch` experiment. It defaults to `false`, production rejects `true`, and current Practice simulations and interactive mock drafts do not use it.

Local and smoke-only variables:

- `MOCKD_E2E_DATA_FILE`: keeps the file-backed E2E store after `npm run test:e2e`.
- `MOCKD_E2E_BASE_URL` or `PLAYWRIGHT_BASE_URL`: points `npm run test:e2e:deployed` at an already-running platform web process.
- `MOCKD_E2E_DEPLOYED_COMMISSIONER_EMAIL` and `MOCKD_E2E_DEPLOYED_COMMISSIONER_PASSWORD`: credentials for a pre-provisioned owner or admin smoke account.
- `MOCKD_E2E_DEPLOYED_MEMBER_EMAIL` and `MOCKD_E2E_DEPLOYED_MEMBER_PASSWORD`: credentials for a pre-provisioned member smoke account.
- `MOCKD_E2E_DEPLOYED_SEASON_ID`: a dedicated published smoke season with both accounts assigned to teams, stored catalog and keeper data, and no existing real draft room.
- `MOCKD_E2E_RUN_ID`, `MOCKD_E2E_PASSWORD`, `MOCKD_E2E_EMAIL_DOMAIN`, and `MOCKD_E2E_PROVISIONING_TOKEN`: local fixture bootstrap controls. The deployed runner rejects them.

Optional read-only provider variables:

- FantasyPros: `FANTASYPROS_API_KEY` enables the scheduled rankings, projections, player-catalog, and player-news sync. Optional `MOCKD_FANTASYPROS_REFRESH_ENABLED=false` pauses the sync without removing the key, and `MOCKD_FANTASYPROS_SEASON` overrides the requested season. Without the key every FantasyPros surface stays dark: the refresh no-ops and the repositories serve empty. The key is server-side only and never reaches the browser. Scheduled usage is 157 requests per day against a 500 per day quota: 61 for rankings, projections, and the catalog, plus 96 for news at a fifteen-minute cadence. Requests are spaced a few seconds apart so a boot pass cannot burst, and a dataset FantasyPros refuses on rate (HTTP 429) waits for its next scheduled run instead of retrying in half an hour, which keeps a throttled day at the same 157 rather than multiplying it. `/fantasypros-status` names a throttled dataset in its `lastError`, and the message clears once the dataset succeeds again.
- Player news: `MOCKD_PLAYER_NEWS_REFRESH_ENABLED=false` stops the news refresh, including the keyless RotoWire feed. News is fetched only by the background refresh, never on a page request, so switching it off leaves the page serving whatever is already stored. The end-to-end runner sets it to `false` so a local run reaches no public feed.
- Yahoo: `MOCKD_YAHOO_CLIENT_ID`, `MOCKD_YAHOO_CLIENT_SECRET`, and optional `MOCKD_YAHOO_REDIRECT_URI`.
- ESPN local testing: `MOCKD_ESPN_LEAGUE_ID`, `MOCKD_ESPN_SWID`, `MOCKD_ESPN_S2`.
- These are not domain blockers unless the launch explicitly includes provider sync. ESPN import/writeback is not a launch dependency.

Production variables still missing from code:

- No implemented allowed-origin, cookie-domain, object-storage, rate-limit tuning, metrics, or alert env names exist yet. Auth endpoints keep fixed-window attempt state in Postgres in production, so limits are shared across web replicas. Login limits are client-address scoped; signup, verification-email, and password-reset-email limits also share normalized-email protection against mail bombing. If the chosen host requires any missing setting to make the public domain safe, domain readiness is no-go until code exposes and verifies it.

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

2. Apply migrations before the web rollout:

   ```bash
   DATABASE_URL="$PRODUCTION_DATABASE_URL" npm run platform:migrate
   ```

   Expected output is `Applied N platform migration statements.` A repeat run should be safe and can print `Applied 0 platform migration statements.`

   Migration `platform-snake-live-room-v20` only makes recorded draft prices nullable. The previous release remains compatible with auction rooms because auction writes still include a price, but its snapshot decoder does not accept a snake room at all. Deploy v20 and the new web process first, verify the release, and wait until application rollback is no longer expected before creating the first hosted snake room. Creating that room is the roll-forward boundary; restoring the database to a point before it was created is the fallback if roll-forward cannot recover the release.

   Migration `platform-league-credential-encryption-v21` is additive. It leaves the old `espn_s2` and `swid` columns in place so the previous web process can finish a zero-downtime deploy. New writes use only the encrypted envelope columns, so the previous release cannot read a connection created or repaired by the new release. When the new release reads an existing plaintext connection, it may populate the envelope columns but does not clear the legacy columns. Existing plaintext connections therefore remain readable by both releases until the explicit backfill. After the new release is stable and every old web process has stopped, run `npm run platform:credentials:backfill`. Do not run the backfill before deciding the release will not roll back: it atomically refreshes the envelope from any current ESPN plaintext, makes every stored ESPN credential envelope-only, and discards cookie values historically saved on non-ESPN connections.

   Migration `platform-auth-rate-limits-v22` is additive. The previous release ignores the new table, so schema rollback is safe, but authentication limits are not shared across every replica until all old web processes have stopped.

   Migration `platform-league-sync-revisions-v23` is additive and initializes both revision columns to zero. The previous release can still read and write the tables, but its league-sync SQL does not enforce revision claims. Avoid provider sync and import during the zero-downtime swap. After every old web process has stopped, rerun any sync or import attempted during that window. Application rollback does not require a database restore.

   Migration `platform-practice-persistence-v25` must follow the separately shipped v24 scale migration. Its bridge backfills normalized mock rows and accepts only revision-valid command-prefix extensions from old snapshots. First deploy with `MOCKD_PRACTICE_PERSISTENCE_MODE=dual-write`; v25 reads normalized rows and atomically mirrors committed mutations back to snapshots while pre-v25 processes drain. Verify session coverage in both directions and normalized event counts, then deploy with `MOCKD_PRACTICE_PERSISTENCE_MODE=normalized-only`. That startup atomically disables the bridge and scrubs compatibility sessions. Readiness requires the scrub to remain complete, and the retired bridge rejects stale writes that contain mock sessions. Treat the second deployment as a roll-forward boundary.

3. Check production/domain runtime readiness:

   ```bash
   HOST=0.0.0.0 PORT="$PORT" DATABASE_URL="$PRODUCTION_DATABASE_URL" \
   MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY=/var/lib/mockd/draft-tools \
   MOCKD_ALLOW_PUBLIC_SIGNUP=true MOCKD_AUTH_EMAIL_MODE=resend \
   RESEND_API_KEY="$RESEND_API_KEY" MOCKD_EMAIL_FROM="$MOCKD_EMAIL_FROM" \
   MOCKD_PUBLIC_BASE_URL="$MOCKD_PUBLIC_BASE_URL" \
   MOCKD_LEAGUE_CONNECTION_CREDENTIAL_ACTIVE_KEY_ID="$MOCKD_LEAGUE_CONNECTION_CREDENTIAL_ACTIVE_KEY_ID" \
   MOCKD_LEAGUE_CONNECTION_CREDENTIAL_KEYS="$MOCKD_LEAGUE_CONNECTION_CREDENTIAL_KEYS" \
   npm run platform:ready
   ```

   This preflight checks runtime config, Postgres connectivity, required migration IDs, and writable private draft storage. The human checklist below still gates league setup, backups, DNS, smoke, and rollback.

4. Create and verify a staging league:

   - Create the commissioner account, verify it from the delivered email, sign in, and complete one forgot-password/reset cycle.
   - Create a league in the product and import its ESPN league URL or ID.
   - Review the detected team count, scoring, draft format, budget, roster slots, and position limits.
   - Import team and manager names from the ESPN members screenshot, import historical draft results, enter keepers, and publish only after the final review passes.
   - Use `platform:provision` only as an operator-controlled recovery or migration path. Never use `platform:seed:e2e` in production.

   The optional declarative recovery path requires a reviewed document outside fixture/E2E directories and password hashes in the secret store:

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

     Use the reviewed real league shape, with 4 to 20 teams, its exact draft and roster settings, and all real catalog players; the one-team example only shows field names. Account emails and IDs must be unique. `actorAccountId` must have an owner or admin membership. Membership team/owner IDs, initial rosters, and keepers must reference records in the same document. Active/published keepers must match a `source: "keeper"` initial-roster row and price. `provisioningId` becomes the immutable source version for `league_season_draft_setups`. The command rejects fixture paths and known local E2E identifiers even if the document says `production`.

     The command covers the normalized account, league setup, `players`, `keeper_declarations`, `league_season_draft_setups`, and `audit_events` records. Continue to use the approved admin/UI/API path for historical imports and the active pricing snapshot, then verify both before launch.

   - Local or throwaway staging only:

     ```bash
     MOCKD_PLATFORM_DATA_FILE=/tmp/mockd-platform-store.json npm run platform:seed:e2e
     ```

     or, for a throwaway Postgres rehearsal:

     ```bash
     DATABASE_URL="$STAGING_DATABASE_URL" npm run platform:seed:e2e
     ```

5. Start the web service:

   ```bash
   HOST=0.0.0.0 PORT="$PORT" DATABASE_URL="$PRODUCTION_DATABASE_URL" MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY=/var/lib/mockd/draft-tools npm run platform:web
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

   Create the smoke accounts and staging season through the normal product flow before the run. The commissioner must have owner or admin access, both accounts must have distinct assigned teams, and the season must include its stored draft setup without an existing real room. The deployed runner refuses local fixture bootstrap variables, signs in through normal authentication, and uses only authenticated product actions. The read-only production smoke must not mutate the real room; use an isolated rehearsal environment for mutation-heavy checks. No HTTP provisioning token is required.

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
- A committed room mutation publishes its revision through Postgres
  `LISTEN`/`NOTIFY`, so streams connected to another web process wake
  immediately. The open stream still checks the scalar `current_revision` on
  every 15-second heartbeat as recovery. An unchanged heartbeat does not load
  a room projection or replay draft events.
- Browser room state reads use the bounded `draft_rooms.current_projection_json`
  projection. Mutation, correction, undo, and recovery keep the append-only
  event log as the source of truth.

Event-stream connection limits:

- Open streams are capped at 4 per authenticated account and 650 globally by default.
  `MOCKD_LIVE_DRAFT_EVENT_STREAM_MAX_CONNECTIONS` can raise the shared Postgres-backed
  global cap; production readiness rejects values below 650.
  across web processes.
- Overflow receives `429 Too Many Requests` with `Retry-After: 5`.
- Postgres leases serialize admission under one advisory transaction lock.
  Completed and disconnected streams release capacity immediately; expired
  leases recover capacity after a crashed process.

## Offline Live Draft Flow

- Commissioner prepares league settings, teams, owners, keepers, and historical imports before draft day.
- Commissioner publishes the league season and active pricing snapshot.
- Commissioner creates an auction or snake live room from that published season.
- League members log in, open the room, and select the team they want to view.
- In auction rooms, the commissioner logs sales with fast commands like `cam puka 62`.
- In snake rooms, the commissioner or manager on the clock chooses an available player without a price.
- Each sale or pick runs validation, appends a draft event, updates projections, increments `revision`, and broadcasts over SSE.
- Board, rosters, draft order, auction budgets, event log, and export state all read from Postgres-backed projections.
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
- No backup of `MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY`. It is container-local scratch for the classic draft-tools routes, and a restart discards it by design.

`pg_dump` includes the entire `league_connections` table. Before the first backup after this migration, run the credential backfill and require the following query to return zero. Otherwise that backup still contains legacy plaintext ESPN session material.

```sql
SELECT count(*) AS legacy_plaintext_credentials
FROM league_connections
WHERE espn_s2 IS NOT NULL OR swid IS NOT NULL;
```

After it returns zero, database backups contain authenticated credential envelopes rather than plaintext cookie values. Backups remain sensitive because they contain other private application data. The encryption keyring is intentionally outside the dump; a restored app needs the matching retained keys before it can sync ESPN. For rotation, add the new key, make it active, deploy, rerun `npm run platform:credentials:backfill`, then verify `SELECT credentials_key_id, count(*) FROM league_connections WHERE credentials_key_id IS NOT NULL GROUP BY credentials_key_id;` before removing an old key.

The plaintext columns are temporary compatibility fields. Remove them with two later releases: first deploy code that no longer selects or writes `espn_s2` and `swid`; after every process runs that code and the zero-plaintext query still passes, deploy a separate contract migration that drops the columns. Never put the code removal and column drop in the same zero-downtime release.

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
9. Start web against the restored database. Log in with a restored test account, such as `commissioner@mockd.local` / `mockd local demo password1!` from `platform:seed:e2e`, open the restored room, and read/download the export artifact.
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
- Import, model run, simulation, and export success/failure counts.
- Postgres connection usage, slow queries, backup success/failure.

Alerts:

- App unavailable or elevated 5xx.
- Postgres unavailable or pool exhaustion.
- Backup failure.
- Repeated import/model/simulation/export failures.
- Live draft mutation failures during a scheduled draft window.
- SSE reconnect/fallback spike during draft night.

## Draft-Night Rehearsal

Run the mutation-heavy checks against an isolated rehearsal deployment and database configured through the same product flow commissioners will use. Never create a disposable room or log test sales in the real production season. After the isolated rehearsal passes, run the read-only deployed smoke with commissioner and member accounts against production.

- Confirm the staging league review shows the intended accounts, memberships, teams, rules, catalog, historical imports, keepers, and active pricing snapshot.
- Import at least one historical draft sheet and verify totals.
- Publish a pricing snapshot.
- Create a test live room.
- Connect commissioner plus at least two member browsers.
- Log sales with command forms such as `cam puka 62` and natural forms such as `Cam took Puka for 62`.
- Verify roster max errors, budget errors, undo, correction, SSE reconnect, and polling fallback.
- Generate the one-sheet export and compare against the room rosters.
- Record a pre-draft PITR timestamp, create/download a logical database export, and confirm neither service has a persistent disk attached.
- Confirm incident contacts and the degraded-mode procedure.

## Incident And Degraded Mode

If SSE fails:

- Keep normal `POST` mutations active.
- Switch clients to polling fallback with `afterRevision`.
- Show a visible degraded realtime banner.

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
| Migrations | `DATABASE_URL="$PRODUCTION_DATABASE_URL" npm run platform:migrate` completed before web rollout, repeat-run output is safe, readiness reports no missing migrations through `platform-practice-persistence-v25` after v24, and `league_season_draft_setups` exists. |
| Runtime env | `npm run platform:ready` passes with production env; production has `DATABASE_URL`, correct `HOST`/`PORT`, Postgres pool/timeout settings, `MOCKD_LIVE_DRAFT_DATA_MODE=postgres`, public signup, Resend delivery, a verified sender, the public HTTPS origin, the active ESPN credential key id and retained keyring, a writable `MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY`, no attached disk, and no `MOCKD_PLATFORM_DATA_FILE` or startup schema init. |
| Account recovery | A new account requires email verification, verification and reset links expire and cannot be replayed, and forgot-password works without revealing whether an email exists. |
| League setup | A commissioner created and published the staging league through the product; settings, team mappings, historical imports, keepers, and active pricing are correct; no `platform:seed:e2e` fixture accounts are present in production. |
| Realtime | Two web processes receive the same committed sale over SSE without waiting for the 15-second recovery check; `events?afterRevision=N` also recovers it; a 201st global stream and a fifth account stream receive `429`. |
| Draft commands | Sale, undo, end, idempotency, stale revision, budget, roster, and position maximum validation pass in staging. |
| Export | Final export artifact is created after room end and content is readable after restore. |
| Backups | Automated backups and alerts are enabled, the ESPN plaintext query returns zero, the pre-cutover UTC recovery point and logical export are recorded, the matching credential keyring is retained outside Postgres, and restore rehearsal has passed within 7 days. |
| Monitoring | Uptime, 5xx, Postgres availability, backup failure, and draft-window mutation alerts route to named owners. |
| Provider risk | Yahoo remains unavailable until its approved API path exists. ESPN credentials are write-only in the browser, masked by default, encrypted in Postgres, absent from public responses, and verified after restore with a dedicated staging connection. |
| Degraded mode | Manual draft board fallback, recovery owner, and user comms are ready for draft night. |
