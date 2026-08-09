# Fantasy Draft Platform Orchestration

Important: This plan is a reference, not a contract. The codebase is always the source of truth. If merged code contradicts this plan, follow the code.

## Source Snapshot

- Base branch: `origin/main`
- Planning branch: `codex/platform-architecture-epics`
- Planning worktree: `/Users/cameronfarina/personal-projects/Mockd-platform-architecture`
- Prior prototype context: local Mockd draft board, simulations, mock drafting, league-calibrated pricing, and hosted offline live draft room MVP work.
- Local dirty work isolated elsewhere: `/Users/cameronfarina/personal-projects/Mockd-live-draft-room-mvp`

## Product Thesis

Mockd is a league-calibrated fantasy draft prep platform.

The core product helps league members prepare for their specific fantasy league through historical auction imports, calibrated expected prices, private mock drafts, private simulations, and private strategy coaching. The live draft room is the final draft-day mode that uses the same league season data and records the in-person offline draft.

## Foundational Product Split

### Shared League Workspace

Visible to league members:

- league settings
- league teams and owners
- keeper declarations and prices
- prior-year offline draft imports
- calibrated public expected prices
- shared player board
- live draft room
- final draft sheet export

### Private Prep Workspace

Private to each user:

- mock draft sessions
- simulation jobs and results
- saved strategies and target lists
- coach conversations
- personalized notes and preferences

Privacy rule: league truth is shared; draft strategy is private.

## Architecture Decisions So Far

- Accounts are in scope for MVP: email/password login, secure sessions, league memberships.
- First production target is one league with about 18 users, but the architecture should not hard-code one league.
- ESPN writeback/import is out of scope as a reliable dependency.
- Historical Excel/CSV imports are core product input and should affect expected prices.
- Simulations/mock drafting are launch-critical, not a later add-on.
- Live draft room uses server-owned state, normal POST writes, SSE updates, and polling fallback.
- Postgres is the production source of truth.
- Browser localStorage is only for harmless preferences, not draft data or auth.
- Export is a single spreadsheet-style draft sheet with columns by team and players/prices in rows.

## Staff Engineer Ownership

| Epic | Owner | Focus |
| --- | --- | --- |
| 1 | Staff Eng 1 | Accounts, sessions, league memberships, and permissions |
| 2 | Staff Eng 2 | League setup, teams, owners, keepers, and rules |
| 3 | Staff Eng 3 | Historical draft imports and player identity resolution |
| 4 | Staff Eng 4 | League-calibrated pricing model and model versioning |
| 5 | Staff Eng 5 | Simulation engine, jobs, results, and worker architecture |
| 6 | Staff Eng 6 | Interactive mock draft engine and private mock sessions |
| 7 | Staff Eng 7 | Strategy coach, plan builder, and private context boundaries |
| 8 | Staff Eng 8 | User prep dashboard and private/shared workspace UX |
| 9 | Staff Eng 9 | Live draft room, realtime SSE, and commissioner workflow |
| 10 | Staff Eng 10 | Export, operations, backups, observability, and reliability |

## Contract Boundaries To Align

- user/session/league membership model
- league season and settings schema
- historical import file contract and validation errors
- pricing model input/output/version contract
- simulation job/result contract
- mock draft session contract
- private strategy context contract
- live draft room event format
- role-based state response contract
- final export sheet format

## Orchestration Rules

- Each staff engineer owns one epic and one disjoint planning artifact under `epics/`.
- Cross-epic dependencies should be explicit.
- Shared-vs-private data boundaries must be called out in every epic.
- Every epic must state launch-critical scope, deferred scope, acceptance criteria, data model impact, API/events impact, and test strategy.
- The integrated roadmap should sequence foundation before parallel implementation.

## Implementation Progress

- `4413993` added the initial platform domain foundation for accounts, league seasons, private prep artifacts, jobs, simulations, mock sessions, live rooms, and draft exports.
- `b05bd1c` added the platform app facade that enforces auth, membership, shared mutation roles, private prep boundaries, live room mutations, and final draft export access.
- `06a717c` added the framework-neutral HTTP contract, setup import parser/apply helpers, platform job orchestration helpers, and the Postgres schema contract.
- `a913a70` added the Node HTTP adapter, setup import API helpers/routes, file-backed platform persistence, and live draft read-model/SSE contracts.
- Current batch adds historical import source parsing, deterministic league-calibrated pricing rebuild snapshots, server-worker simulation job handlers, local platform server composition, and worker-safe private simulation execution.
