# Fantasy Draft Platform Implementation Slices

Important: These slices are intended as stacked PR boundaries. Keep each slice mergeable and useful on its own.

## [1] Auth And Session Foundation

- Type: Feature
- Slice category: Foundation
- Owner: Staff Eng 1
- Depends on: None
- Suggested PR boundary: users, sessions, auth routes, session bootstrap, auth tests

### Scope

Add email/password auth with secure HttpOnly session cookies and a current-session bootstrap endpoint.

### Acceptance Criteria

- User can sign up, log in, refresh, remain logged in, and log out.
- Session tokens are hashed server-side and never stored in `localStorage`.
- Expired/revoked sessions return `401`.

## [2] League Membership And Role Model

- Type: Feature
- Slice category: Foundation
- Owner: Staff Eng 1
- Depends on: [1]
- Suggested PR boundary: leagues, memberships, authorization middleware, permission tests

### Scope

Add leagues and league memberships with roles for owner/admin/member/observer as needed.

### Acceptance Criteria

- One production league can be seeded with about 18 users.
- League-scoped APIs reject unauthenticated users and non-members.
- Admin-only routes reject normal members.

## [3] League Season Runtime Config

- Type: Feature
- Slice category: Foundation
- Owner: Staff Eng 2
- Depends on: [2]
- Suggested PR boundary: league seasons, settings, rules, team setup, seed migration

### Scope

Represent current static league config as runtime league-season data: teams, owners, roster rules, auction settings, keeper policy, draft date, and readiness status.

### Acceptance Criteria

- Current local league config can be represented without editing TypeScript constants.
- Two test seasons with different rules can coexist.
- Shared state includes teams, owners, rules, keepers, readiness, and active model metadata.

## [4] Keeper Setup And Publish Flow

- Type: Feature
- Slice category: User-facing behavior
- Owner: Staff Eng 2
- Depends on: [3]
- Suggested PR boundary: keeper declarations, validation, publish/lock state

### Scope

Allow commissioner/admin keeper entry, preview, validation, and publish/lock workflow.

### Acceptance Criteria

- Keeper costs default to `ceil(previousCost * 1.20)`.
- Duplicate kept players, invalid prices, and unknown teams block publish.
- Members can view published keepers and prices.

## [5] Historical Import Pipeline

- Type: Feature
- Slice category: Foundation
- Owner: Staff Eng 3
- Depends on: [3]
- Suggested PR boundary: upload, parser, mapping, preview, import state tests

### Scope

Accept CSV/XLSX historical auction imports in current wide-board and normalized-template formats.

### Acceptance Criteria

- Current historical boards import with matching row counts and spend totals.
- Preview shows rows, warnings, blockers, and mapping state before commit.
- Import batches are idempotent by league/season/file hash unless replacing.

## [6] Player Identity Resolution

- Type: Feature
- Slice category: Correctness/reliability
- Owner: Staff Eng 3
- Depends on: [5]
- Suggested PR boundary: canonical player table, aliases, resolver, resolution UI/API

### Scope

Resolve imported player text to canonical player IDs using exact, alias, position-aware, DST, fuzzy, and manual decisions.

### Acceptance Criteria

- Ambiguous matches require confirmation before commit.
- Manual decisions create reusable aliases.
- Original and canonical player names are preserved.

## [7] Versioned Pricing Snapshots

- Type: Feature
- Slice category: Foundation
- Owner: Staff Eng 4
- Depends on: [4], [5], [6]
- Suggested PR boundary: model runs, pricing snapshots, player prices, explanation payloads

### Scope

Persist immutable model runs and pricing snapshots from normalized league inputs.

### Acceptance Criteria

- Same model version and same inputs produce stable outputs.
- Every board price references model run, model version, scenario, and input snapshot.
- Market price, live price, personal value, and max bid are separate fields.

## [8] Pricing Explainability And Readiness Gates

- Type: Feature
- Slice category: Correctness/reliability
- Owner: Staff Eng 4
- Depends on: [7]
- Suggested PR boundary: explanation API, warning/readiness checks, golden tests

### Scope

Expose why a price exists and block/flag stale or incomplete inputs before draft use.

### Acceptance Criteria

- Price explanation includes public anchors, league adjustments, keeper effects, strategy effects, and warnings.
- Readiness catches stale projections, failed imports, missing keepers, and unresolved players.

## [9] Postgres-Backed Job Runner

- Type: Feature
- Slice category: Foundation
- Owner: Staff Eng 5
- Depends on: [2]
- Suggested PR boundary: job table, claim/heartbeat/retry/cancel lifecycle, worker process

### Scope

Add a worker framework for import parsing, model runs, simulations, exports, and maintenance jobs.

### Acceptance Criteria

- API submits jobs quickly and worker claims them with row locking.
- Jobs support queued/running/completed/failed/canceled states.
- Transient failures retry and permanent failures surface sanitized errors.

## [10] Private Simulation Jobs And Results

- Type: Feature
- Slice category: User-facing behavior
- Owner: Staff Eng 5
- Depends on: [7], [9]
- Suggested PR boundary: simulation submit/status/result APIs, result persistence, privacy tests

### Scope

Run private batch simulations with forced players/prices, targets, caps, path constraints, and deterministic seeds.

### Acceptance Criteria

- Simulation submit returns `202` and durable job id.
- Results remain tied to immutable input snapshots.
- Same-league users cannot access another user's simulation jobs/results.

## [11] Mock Session Event Model

- Type: Feature
- Slice category: Foundation
- Owner: Staff Eng 6
- Depends on: [7]
- Suggested PR boundary: mock sessions, events, replay, reset semantics

### Scope

Persist private interactive mock sessions with append-only commands, deterministic replay, reset, and stale-tab rejection.

### Acceptance Criteria

- New mock starts from fresh shared inputs and does not reuse completed state.
- Reset invalidates derived results.
- Mutations require expected version/command count.

## [12] Interactive Mock Draft UX And AI Owners

- Type: Feature
- Slice category: User-facing behavior
- Owner: Staff Eng 6
- Depends on: [11]
- Suggested PR boundary: command bar, AI nomination/bid loop, result pages

### Scope

Let a user draft against league-calibrated AI owners through a complete auction.

### Acceptance Criteria

- `draft Puka` resolves when unambiguous and asks for clarification when ambiguous.
- AI owners obey budget, roster slots, keeper locks, sold-player constraints, and owner profiles.
- Mock actions cannot mutate live room state.

## [13] Private Strategy Artifacts

- Type: Feature
- Slice category: Foundation
- Owner: Staff Eng 7
- Depends on: [2], [7]
- Suggested PR boundary: plans, plan versions, targets, notes, ownership tests

### Scope

Persist private strategy plans, target lists, max bids, guardrails, and notes.

### Acceptance Criteria

- Users can save and edit private plans and target lists.
- Private artifacts require league membership plus exact user ownership.
- Commissioners cannot view private prep by default.

## [14] Strategy Coach And Plan Handoff

- Type: Feature
- Slice category: User-facing behavior
- Owner: Staff Eng 7
- Depends on: [10], [13]
- Suggested PR boundary: coach context assembly, structured plan output, simulation handoff

### Scope

Add private coach chat grounded in shared league truth and the user's private prep, with structured output into plans and simulations.

### Acceptance Criteria

- Coach answers cite shared/model inputs used.
- Coach refuses or omits another user's private artifacts.
- Approved plan versions can start private simulation jobs.

## [15] Prep App Shell And Shared Board

- Type: Feature
- Slice category: User-facing behavior
- Owner: Staff Eng 8
- Depends on: [3], [7]
- Suggested PR boundary: app shell, League/Board navigation, shared board/team panels

### Scope

Create the authenticated prep workspace around the board as the primary surface.

### Acceptance Criteria

- Member can see league status, board, teams, keepers, model freshness, and readiness warnings.
- Board supports search, position filters, sort, tiers, keeper status, and price explanations.
- Team panels show keepers, spend, needs, and budget context.

## [16] Private Prep Workspace UX

- Type: Feature
- Slice category: User-facing behavior
- Owner: Staff Eng 8
- Depends on: [10], [11], [13], [14], [15]
- Suggested PR boundary: Mock/Simulations/Strategy/Coach views and shared/private state separation

### Scope

Expose private mocks, simulations, targets, notes, strategy, and coach history from one consistent workspace.

### Acceptance Criteria

- Shared market price and private max bid are visually distinct.
- User can move between Board, Mock, Simulations, Strategy, and Coach without losing context.
- Same-league cross-user private access is rejected server-side.

## [17] Live Draft Room Event Store

- Type: Feature
- Slice category: Foundation
- Owner: Staff Eng 9
- Depends on: [3], [7], [15]
- Suggested PR boundary: draft rooms, events, projections, validation, replay tests

### Scope

Create live draft rooms from published seasons with append-only events and projection tables for board/team/budget reads.

### Acceptance Criteria

- Commissioner can start a room only from published setup.
- Sale, undo, correction, start, and end append events transactionally.
- Projection replay reproduces stored room state.

## [18] Commissioner Command And Realtime Flow

- Type: Feature
- Slice category: User-facing behavior
- Owner: Staff Eng 9
- Depends on: [17]
- Suggested PR boundary: command parser, SSE, polling fallback, live UI

### Scope

Support fast commissioner sale commands, roster/budget validation, SSE fanout, reconnect, and polling fallback.

### Acceptance Criteria

- `cam puka 62` commits one sale and broadcasts one update.
- Impossible commands return clear errors and do not mutate state.
- SSE reconnect and polling both recover missed revisions.

## [19] One-Sheet Draft Export

- Type: Feature
- Slice category: User-facing behavior
- Owner: Staff Eng 10
- Depends on: [17]
- Suggested PR boundary: export generator, download API, tests

### Scope

Generate one workbook sheet with team player/price columns from committed draft state.

### Acceptance Criteria

- Export prices are numeric.
- Export includes keepers and live auction buys.
- Export matches committed Postgres draft results.

## [20] Production Operations Gate

- Type: Task
- Slice category: Rollout/validation
- Owner: Staff Eng 10
- Depends on: [1], [9], [18], [19]
- Suggested PR boundary: deployment docs, logs/metrics, rate limits, backup/restore runbook

### Scope

Add production readiness: env config, backups, restore rehearsal, logs, metrics, rate limits, and launch runbook.

### Acceptance Criteria

- Web, worker, Postgres, queue/cache decision, and scheduled jobs are documented.
- Backups run and failures alert.
- Restore smoke has been rehearsed against non-production data.
- Rate limits protect auth, imports, jobs, live mutations, SSE, polling, and exports.

## Recommended Build Order

1. [1], [2], [3]
2. [4], [5], [6]
3. [7], [8], [9]
4. [10], [11], [13], [15]
5. [12], [14], [16]
6. [17], [18], [19]
7. [20]

This order keeps the shared/private data boundary stable before product surfaces depend on it.
