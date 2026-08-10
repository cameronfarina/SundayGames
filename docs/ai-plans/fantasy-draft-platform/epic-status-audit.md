# Fantasy Draft Platform Epic Status Audit

Important: This audit is a planning checkpoint, not a product release note. The codebase is always the source of truth. If this document and current code disagree, follow the code.

## Current Product Reality

The platform backend foundation is ahead of the visible product UI.

The current visible draft UI still feels like separate apps because it grew from the local draft room:

- Real draft
- Mock draft
- My expert
- Player news
- Dedicated draft room

The new platform work added durable API and repository foundations, but it did not add a login screen, signup screen, league home, or unified app shell. Users cannot yet self-serve through the product UI.

## Landed On Main

- `4413993`: platform domain foundation for accounts, league seasons, private prep artifacts, jobs, simulations, mock sessions, live rooms, and exports.
- `b05bd1c`: platform app facade with auth, membership, shared mutation roles, private prep boundaries, live room mutations, and export access.
- `06a717c`: framework-neutral HTTP contract, setup import helpers, job orchestration helpers, and Postgres schema contract.
- `a913a70`: Node HTTP adapter, setup import routes, file-backed platform persistence, and live room read-model/SSE contracts.
- `81b4e16`: historical source parsing, pricing rebuild snapshots, server-worker simulation handlers, local server composition, and worker-safe private simulations.
- `f691eb5`: historical imports, pricing rebuilds, simulation jobs/results, and live draft export artifacts wired through app/HTTP/worker boundaries.
- `7418fe7`: transitional Postgres snapshot bridge.
- `b56361c` and `c6c1483`: normalized Postgres job queue and web/worker runtime wiring.
- `f10c01f`: job cancellation lifecycle.
- `0689f5e`: terminal job reruns and simulation reset semantics.
- `77eaa71`: normalized Postgres simulation repository.
- `d800e51`: normalized Postgres account/session repository.
- `f8e0f0c`: normalized Postgres league setup repository.
- `c035a74`: normalized Postgres historical import repository.

## Epic Audit

| Epic | Status | Done | Remaining |
| --- | --- | --- | --- |
| 1. Accounts, sessions, league memberships | Backend foundation partially landed | Account/session service, Postgres account/session repository, API-level create/login paths, session-token hashing, tests | Login/signup UI, current-session bootstrap UI, logout UI, production cookie/session polish, invitation/seed workflow, user-facing account errors |
| 2. League setup, teams, owners, keepers, rules | Backend foundation partially landed | League season model, setup import helpers, Postgres league setup repository, team/membership/rules persistence, FK-safe team replacement | Commissioner setup UI, keeper editing/publish/lock UI, production league seed/import path, clear member view of league state, setup validation screens |
| 3. Historical draft imports | Backend foundation partially landed | Historical parser, preview/commit workflow, Postgres import batches, committed sale rows, supersede-with-audit behavior, pricing read path for current committed records | File upload UI, Excel workbook adapter UI, player identity resolution UI, commissioner review/commit screen, import status in league home |
| 4. League-calibrated pricing | Domain and snapshot foundation exists | Pricing rebuild workflow, pricing snapshot repository, current calibration logic, audit/test coverage from local engine | Normalized model-run/player-price Postgres repositories, published model selection UI, price explanation UI, stale input/readiness warnings |
| 5. Simulation worker system | Foundation mostly landed | Postgres job queue, worker process, private simulation repository, job cancel/rerun semantics | Product UI for queued/running/completed jobs, richer failure/retry UX, production worker ops, import/pricing/export job handlers where still unsupported |
| 6. Interactive mock drafting | Local product exists; platform integration incomplete | Local interactive mock engine/UI, platform mock session domain and privacy boundaries | Durable Postgres mock event repository, fresh-start UI on platform shell, mock results scoped to selected run, AI-owner behavior hardening |
| 7. Strategy coach and plan builder | Prototype/domain concepts exist; product incomplete | Local strategy lab/planning logic and some coach-style plan generation | Model-backed private coach chat, saved private strategy artifacts, plan-to-simulation handoff UI, citation/grounding rules |
| 8. User prep dashboard and workspace UX | Not landed as a unified product shell | Planning artifact exists | Login gate, league home, unified navigation, reusable board/team panels, private prep workspace, contextual expert/news panels |
| 9. Live draft room realtime | Local/draft-room foundation exists; platform integration incomplete | Live draft domain, command parsing, validation, read-model/SSE contracts, draft export domain | Postgres live room event/projection repositories, unified live-mode UI using same board/team panels, room setup/share UX, draft-night rehearsal |
| 10. Export, ops, reliability | Planning and some domain foundation exists | One-sheet export domain, export artifact persistence, production runbook | Export UI, production deployment, backups/restore rehearsal, rate limits, observability, launch checklist |

## Highest-Risk Gap

The highest-risk gap is not another repository. It is product integration.

The backend now has several correct seams, but the user still sees the older local draft room. Tomorrow's first work should make the app feel like one product:

1. Auth shell: signup, login, logged-in session state.
2. League home: active league, setup/import/model readiness, next actions.
3. Draft prep workspace: shared board and team panels as the primary surface.
4. Private lab: mock drafts, simulations, plans, and coach under the same shell.
5. Context panels: My Expert and Player News become board/team/player context, not separate mini-apps.
6. Live draft mode: dedicated room uses the same board/team panels plus commissioner command bar and realtime state.

## Team Update For Tomorrow

- Staff Eng 1 should own visible auth/session UX and verify API/session behavior from a browser.
- Staff Eng 2 should own league setup/readiness UI and the production league seed/import path.
- Staff Eng 3 should own commissioner historical import review UI.
- Staff Eng 4 should own model freshness, price explanation, and readiness signals.
- Staff Eng 5 should own job status UX for simulations/imports/model rebuilds.
- Staff Eng 6 should own mock draft sessions and stale-result prevention in the unified shell.
- Staff Eng 7 should own private strategy/coach artifacts and make My Expert contextual.
- Staff Eng 8 should own the unified app shell, navigation, page layout, and shared board/team component contract.
- Staff Eng 9 should own live draft mode reuse of the board/team shell.
- Staff Eng 10 should own export, deploy, backup, observability, and launch checklist.

## Stop/Start/Continue

### Stop

- Stop treating Real Draft, Mock Draft, My Expert, Player News, and Draft Room as separate standalone applications.
- Stop describing backend API readiness as user-facing product readiness.
- Stop adding more persistence slices before the first visible product shell proves the flow.

### Start

- Start with a logged-in app shell and one active league.
- Start every primary screen from the same board/team mental model.
- Start preserving private prep boundaries in the UI, not only in backend tests.

### Continue

- Continue moving high-value state from the snapshot bridge to normalized Postgres repositories.
- Continue using the existing local draft engine behavior as the regression baseline.
- Continue keeping live draft as draft-day mode, not the center of the whole product.
