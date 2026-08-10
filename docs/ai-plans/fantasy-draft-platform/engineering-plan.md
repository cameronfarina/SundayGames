# Fantasy Draft Platform Engineering Plan

Important: This plan is a reference, not a contract. The codebase is always the source of truth. If merged code contradicts this plan, follow the code.

## Source Snapshot

- Base branch: `origin/main`
- Planning branch: `codex/platform-architecture-epics`
- Planning worktree: `/Users/cameronfarina/personal-projects/Mockd-platform-architecture`
- Prior prototype context: local Mockd draft board, simulations, mock drafting, league-calibrated pricing, and hosted offline live draft room MVP work.
- Local dirty work isolated elsewhere: `/Users/cameronfarina/personal-projects/Mockd-live-draft-room-mvp`

## Product Thesis

Mockd is a league-calibrated fantasy draft prep platform.

The core product helps league members prepare for their specific fantasy league through historical auction imports, calibrated expected prices, private mock drafts, private simulations, and private strategy coaching. The live draft room is draft-day mode that uses the same league season data and records an in-person offline draft.

## Non-Negotiable Product Boundaries

- Shared league truth is visible to league members.
- Private prep artifacts are visible only to the creating user.
- Simulations and mock drafting are launch-critical, not secondary to live drafting.
- ESPN import/writeback is not a reliable launch dependency.
- Historical Excel/CSV imports are core input and affect expected prices.
- Postgres is the production source of truth.
- Browser `localStorage` is only for harmless preferences.
- Live draft uses normal authenticated `POST` writes, SSE updates, and polling fallback.
- The final export is one spreadsheet-style sheet with team columns and player/price rows.

## Staff Engineer Ownership

| Epic | Owner | Artifact |
| --- | --- | --- |
| 1 | Staff Eng 1 | `epics/01-accounts-league-memberships.md` |
| 2 | Staff Eng 2 | `epics/02-league-setup-keepers-rules.md` |
| 3 | Staff Eng 3 | `epics/03-historical-draft-imports.md` |
| 4 | Staff Eng 4 | `epics/04-league-calibrated-pricing.md` |
| 5 | Staff Eng 5 | `epics/05-simulation-worker-system.md` |
| 6 | Staff Eng 6 | `epics/06-interactive-mock-drafting.md` |
| 7 | Staff Eng 7 | `epics/07-strategy-coach-plan-builder.md` |
| 8 | Staff Eng 8 | `epics/08-user-prep-dashboard.md` |
| 9 | Staff Eng 9 | `epics/09-live-draft-room-realtime.md` |
| 10 | Staff Eng 10 | `epics/10-export-ops-reliability.md` |

## Architecture Shape

Use a boring serverful architecture:

- Web/API server: authenticated app traffic, league reads, private prep reads/writes, live draft mutations, SSE streams.
- Worker process: historical imports, model recalculation, simulation jobs, export generation, cleanup.
- Postgres: authoritative data for users, sessions, leagues, imports, model runs, private prep, live rooms, events, projections, jobs, and exports.
- Optional Redis/cache later: rate-limit counters, SSE fanout coordination, and high-volume job dispatch if Postgres queue semantics are no longer enough.

Start with Postgres-backed jobs and row locking. Add separate queue infrastructure only when measured worker contention makes it necessary.

## Data Ownership Model

Shared league workspace:

- `leagues`
- `league_seasons`
- `league_memberships`
- `fantasy_teams`
- `team_owner_assignments`
- `roster_rule_sets`
- `scoring_rule_sets`
- `draft_settings`
- `keeper_policies`
- `keeper_declarations`
- `historical_import_batches`
- `historical_draft_sales`
- `model_runs`
- `pricing_snapshots`
- `player_prices`
- `draft_rooms`
- `draft_room_events`
- `draft_room_sales`
- `draft_room_team_states`
- `draft_room_exports`

Private prep workspace:

- `user_prep_profiles`
- `strategy_plans`
- `strategy_plan_versions`
- `target_lists`
- `target_list_items`
- `private_notes`
- `coach_conversations`
- `coach_messages`
- `mock_sessions`
- `mock_session_events`
- `mock_session_results`
- `simulation_jobs`
- `simulation_result_sets`
- `simulation_runs`

Privacy invariant:

League membership permits access to shared league rows. Private prep access also requires exact `user_id` ownership. Commissioner/admin roles do not automatically grant access to private strategy artifacts.

## Core Contracts

### Auth And Membership

- `POST /signup`
- `POST /login`
- `POST /logout`
- `GET /session`

Authenticated requests use secure HttpOnly cookies. Session tokens are never stored in `localStorage`.

### League Season Setup

- `GET /api/seasons/:seasonId/shared-state`
- `GET/PATCH /api/seasons/:seasonId/settings`
- `GET/PATCH /api/seasons/:seasonId/teams`
- `GET/PATCH /api/seasons/:seasonId/keepers`
- `GET /api/seasons/:seasonId/readiness`

Commissioner/admin writes publish immutable shared inputs for model runs, mocks, simulations, and live draft.

### Historical Imports

- `POST /api/leagues/:leagueId/historical-imports`
- `PATCH /api/historical-imports/:batchId/mapping`
- `GET /api/historical-imports/:batchId/preview`
- `POST /api/historical-imports/:batchId/resolutions`
- `POST /api/historical-imports/:batchId/commit`

Imports are previewed and validated before commit. Committed imports become shared league truth.

### Pricing

Pure model boundary:

- `buildLeagueCalibration(inputs)`
- `buildBasePricing(inputs, calibration)`
- `applyKeeperScenario(basePricing, keepers, scenario)`
- `applyLiveDraftState(snapshot, draftState)`
- `applyStrategyOverlay(snapshot, ownerState, strategy)`
- `explainPlayerPrice(snapshot, playerId)`

Market price, live price, personal value, and max bid are distinct fields.

### Simulations

- `POST /api/users/me/seasons/:seasonId/simulation-runs`
- `GET /api/users/me/seasons/:seasonId/simulation-runs`
- `GET /api/simulation-jobs/:jobId`
- `POST /api/simulation-jobs/:jobId/cancel`

Simulation jobs are private, async, idempotent, and tied to immutable model/input references.

### Interactive Mocks

- `POST /api/users/me/seasons/:seasonId/mock-sessions`
- `GET /api/users/me/seasons/:seasonId/mock-sessions`
- `POST /api/mock-sessions/:sessionId/commands`
- `POST /api/mock-sessions/:sessionId/reset`
- `GET /api/mock-sessions/:sessionId/results`

New mocks never reuse completed state unless the user explicitly duplicates one.

### Strategy Coach

- `GET/POST /api/users/me/seasons/:seasonId/coach-conversations`
- `POST /api/coach-conversations/:conversationId/messages`
- `POST /api/strategy-plans/:planId/simulation-job`

Coach context is assembled from shared league truth plus the requesting user's private artifacts only.

### Live Draft

- `POST /api/draft-rooms`
- `POST /api/draft-rooms/:roomId/start`
- `GET /api/draft-rooms/:roomId`
- `GET /api/draft-rooms/:roomId/stream`
- `GET /api/draft-rooms/:roomId/events?afterRevision=N`
- `POST /api/draft-rooms/:roomId/sales`
- `POST /api/draft-rooms/:roomId/undo`
- `POST /api/draft-rooms/:roomId/corrections`
- `POST /api/draft-rooms/:roomId/end`

All mutations append events transactionally before fanout.

### Export

- `POST /api/draft-rooms/:roomId/exports`
- `GET /api/draft-rooms/:roomId/exports/:exportId`

Export reads committed Postgres state and emits one workbook sheet.

## Live Draft State Model

Use a hybrid event/projection model:

- `draft_room_events` is authoritative.
- Projection tables serve fast board, roster, budget, and export reads.
- Sale, undo, and correction run inside one transaction.
- Post-commit fanout sends an SSE event with the committed revision.
- Reconnect uses `Last-Event-ID` or polling with `afterRevision`.
- If a client is too stale, send a snapshot.

This keeps draft-night behavior auditable without making every read replay JSON events.

## Implementation Sequence

### Phase 0: Preserve Current Local Trust

Do not rip out the working local engine. The first hosted slices should wrap and preserve the tested modeling behavior.

Deliverables:

- explicit shared/private domain types
- runtime league-season adapters around current static config
- regression tests for existing pricing, mocks, and readiness checks

### Phase 1: Identity And League Foundation

Build accounts, sessions, leagues, memberships, league seasons, teams, roster rules, and keeper setup.

Exit criteria:

- users can log in
- one production league can be seeded
- shared league state is readable by members
- private ownership checks are enforceable

### Phase 2: Historical Imports And Pricing Persistence

Move historical drafts and model outputs into durable, versioned Postgres records.

Exit criteria:

- current historical boards import through the hosted pipeline
- committed imports reproduce known normalized counts/totals
- model runs produce immutable pricing snapshots
- board prices explain source inputs and model version

### Phase 3: Private Prep Core

Productize private simulations, interactive mocks, target lists, strategy plans, and coach handoffs.

Exit criteria:

- users can run private simulations asynchronously
- users can start fresh mock sessions without stale result leakage
- strategy coach can save a plan and create simulation constraints
- same-league users cannot read each other's prep

### Phase 4: Unified Prep UX

Build the app shell around the board as the center of gravity.

Exit criteria:

- league members can sign up or log in, land on a league home, and move between League, Board, Mock Drafts, Simulations, Strategy, Expert, News, and Live Draft views
- shared market price and private max bid are visibly distinct
- board/team panels are reusable between prep, mock, and live modes
- Real Draft, Mock Draft, My Expert, Player News, and the dedicated Draft Room no longer feel like separate applications

### Phase 5: Live Draft And Export

Launch the in-person live draft room on the same shared state.

Exit criteria:

- commissioner starts a room from published setup
- `cam puka 62` commits one sale with validation
- roster/budget errors block impossible commands
- SSE and polling recover missed updates
- final one-sheet export matches committed room state

### Phase 6: Production Hardening

Add operational guarantees before real league use.

Exit criteria:

- backups and restore runbook exist
- logs, metrics, request IDs, and job observability are present
- rate limits protect auth, imports, jobs, live mutations, SSE, polling, and export
- launch rehearsal covers setup, import, model run, mock, simulation, live draft, undo/correction, export, and restore smoke

## Dependency Map

1. Accounts and league memberships unlock every hosted workflow.
2. League seasons, teams, rules, and keepers unlock imports, pricing, prep, and live draft.
3. Historical imports plus player identity unlock league-calibrated pricing.
4. Pricing snapshots unlock board, simulations, mocks, coach, and live values.
5. Private artifact tables unlock simulations, mocks, strategy, and coach.
6. Board/team component contracts unlock both prep UX and live draft reuse.
7. Live draft event model unlocks realtime state and final export.
8. Operations hardening gates production use.

## Test Strategy

- Unit-test pure domain logic: command parsing, player resolution, roster legality, price stages, keeper inflation, strategy constraints, export shaping.
- Contract-test every API at unauthenticated, non-member, member, owner/admin, and cross-user boundaries.
- Golden-test current league imports/prices against known audited outputs.
- Integration-test the core paths:
  - signup/login/session
  - commissioner setup and publish
  - historical import preview/resolve/commit
  - model run and board read
  - private simulation job completion
  - private mock fresh start/reset/result
  - coach plan to simulation job
  - live room sale/undo/correction/SSE/export
- Run load smoke for 18 users reading shared state while running private prep and one live room.
- Run a staging restore smoke before draft-night use.

## Open Product Decisions

- Confirm whether the first production league has 18 teams or about 18 users including co-owners/observers.
- Confirm whether all league members can see published calibrated prices by default.
- Decide if keeper notes are shared or split into public/private notes.
- Decide whether team owners can edit their own keepers before lock or commissioner-only is launch scope.
- Define launch model-provider choice for the strategy coach.
- Define retention for private mocks, simulations, coach chats, imports, and exports.
- Decide exact draft-night backup cadence and who receives alerts.
- Decide whether live draft supports commissioner override of illegal states, and how those overrides are exported.
