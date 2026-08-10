# Epic 8: User Prep Dashboard And Private/Shared Workspace UX

## Goal

Give every league member a fast, draft-ready prep workspace that separates shared league truth from private strategy work. Members review league setup, board, teams, keepers, and pricing snapshots, then privately mock, simulate, save target lists, refine strategy paths, and chat with a coach.

This epic now owns the product-shell correction. The visible app must stop feeling like separate Real Draft, Mock Draft, My Expert, Player News, and Draft Room apps. The board/team workspace should become the common shell for prep, mocks, simulations, expert context, news context, and live draft mode.

## Launch-Critical Scope

- Logged-out login/signup shell.
- Logged-in app shell with active league/season, user menu, and one navigation model.
- League home for setup/readiness/import/model status and role-based next actions.
- Authenticated prep home for the active league season.
- Shared league summary: draft date, readiness, rules, teams, owners, keepers, active model run, and warnings.
- Shared draft board using the published pricing snapshot, with search, position filters, sort, tiers, keeper status, and explanation entry points.
- Team/owner panels showing shared rosters, keeper spend, remaining needs, and draft-night budget context.
- Private user workspace with saved strategy, target list, max bids, notes, mock sessions, simulation runs, and coach history.
- Mode switch between prep, private mock, simulation results, and live draft room without changing the board/team mental model.
- My Expert and Player News as contextual panels or secondary views inside the same shell, not unrelated full-app experiences.
- Clear freshness/status indicators for model run, keeper lock, imports, and draft readiness.
- Launch path optimized for one league of about 18 users.

## Deferred Scope

- Public marketing dashboard or decorative analytics home.
- Polished cross-league switching.
- Collaborative shared strategy boards.
- Per-artifact sharing controls.
- Mobile-first full live draft control experience.
- Commissioner import/setup editing beyond links into Epic 2/3 flows.
- Advanced dashboard customization.
- Multi-league benchmark widgets.
- Real-time multiplayer private mock rooms.

## Information Architecture And UX

Primary navigation is workflow-based:

- `League`: shared setup, teams, keepers, rules, readiness, and model status.
- `Board`: calibrated player board with shared prices plus private overlays.
- `Mock Drafts`: user-owned mock draft sessions and interactive practice.
- `Simulations`: batch run setup, results, exposures, and strategy comparison.
- `Strategy`: private draft plan, target lists, max bids, notes, and guardrails.
- `Expert`: private recommendations and chat grounded in the user's strategy and league state.
- `News`: player news tied to selected players, targets, roster, and board filters.
- `Live Draft`: same board/team shell in live mode, reading real draft state.

UX principles:

- The board is the center of gravity, not a dashboard card grid.
- Shared facts are visibly shared; private overlays are visibly personal.
- Prep and live draft use the same board, filters, team panels, and player detail patterns.
- Draft-night mode reduces chrome, preserves keyboard/search speed, and makes mutation status obvious.
- Empty states drive action: publish setup, run model, create mock, choose strategy, add targets.
- Real Draft is live draft mode. Mock Draft is private practice mode. Neither should fork the whole product shell.

## Component Contracts

- `PrepAppShell`: route/view selection, active league season, current user, permissions, mode.
- `LeagueReadinessPanel`: shared setup/model/import status; emits links/actions based on role.
- `DraftBoard`: shared player prices plus optional private overlays; emits player selection, shortlist toggles, max-bid edits, and draft actions when live.
- `PlayerDetailDrawer`: price explanation, shared history, keeper status, private notes, target status, coach context.
- `TeamPanel`: teams, keepers, budget/roster state, owner tendencies, live draft needs.
- `PrivateWorkspacePanel`: user strategy, targets, notes, saved views, coach prompts.
- `MockSessionList`: private sessions with mode, seed, scenario, strategy, status, resume/delete/export actions.
- `SimulationRunPanel`: private batch runs, exposures, price ranges, roster outcomes.
- `StrategyPlanEditor`: private strategy path, budget envelopes, build-around players, avoid list, guardrails.
- `CoachPanel`: reads shared league context and private user prep; writes only private conversation/recommendation artifacts.
- `NewsPanel`: reads player news and filters it by board context, roster context, target list, or selected player.
- `LiveDraftModeBar`: room status, countdown/start state, share info, commissioner command, SSE/polling status, and export state.

Components receive shared league state and private user state as separate payloads. No component infers privacy from UI placement.

## Data And API Needs

Shared reads:

- `GET /api/seasons/:seasonId/shared-state`
- `GET /api/seasons/:seasonId/board?modelRunId=&scenarioId=`
- `GET /api/seasons/:seasonId/teams`
- `GET /api/seasons/:seasonId/readiness`
- `GET /api/player-prices/:playerPriceId/explanation`

Private user reads/writes:

- `GET/PATCH /api/users/me/seasons/:seasonId/prep-profile`
- `GET/POST/PATCH/DELETE /api/users/me/seasons/:seasonId/target-lists`
- `GET/POST/PATCH/DELETE /api/users/me/seasons/:seasonId/strategy-plans`
- `GET/POST /api/users/me/seasons/:seasonId/mock-sessions`
- `GET/POST /api/users/me/seasons/:seasonId/simulation-runs`
- `GET/POST /api/users/me/seasons/:seasonId/coach-conversations`

Needed tables or equivalents:

- `user_prep_profiles`
- `user_strategy_plans`
- `user_target_lists`
- `user_target_list_players`
- `user_player_notes`
- `mock_sessions`
- `mock_session_events`
- `simulation_runs`
- `simulation_run_outputs`
- `coach_conversations`
- `coach_messages`
- `saved_board_views`

## Privacy Boundaries

Shared within league:

- league settings, teams, owners, keepers, rules, draft date
- published model runs and shared market prices
- shared player price explanations
- real live draft state
- commissioner/admin setup readiness

Private to user:

- selected strategy
- target lists and max bids
- player notes and personal rankings
- mock sessions and scripts
- simulation inputs/results
- coach conversations and recommendation history
- saved board filters/views unless explicitly made shareable later

Required invariant: league membership permits reading shared league state, but private prep artifacts additionally require user ownership.

## Dependencies

- Epic 1 for accounts, sessions, memberships, and authorization.
- Epic 2 for league setup, teams, keepers, rules, readiness, and shared-state contract.
- Epic 3 for historical import status and commissioner import UX entry points.
- Epic 4 for pricing snapshots, model runs, strategy overlays, and explanations.
- Epics 5 and 6 for simulation and private mock engines.
- Epic 7 for strategy plan semantics, budget envelopes, and coach inputs.
- Epic 9 for live draft room state and shared board/team reuse.
- Epic 10 for persistence, jobs, observability, and production operations.

## Acceptance Criteria

- A league member can open the prep workspace and immediately see shared league status, board, teams, keepers, and model freshness.
- A new user can sign up or log in from a visible UI and land in the authenticated shell.
- A logged-in member can refresh and remain in the same shell when their session is valid.
- A member can create and resume private mocks without affecting the live draft or other users.
- A member can save private targets, max bids, notes, and strategy plans.
- Private prep artifacts are not visible to other members, commissioners included, unless a later sharing feature is added.
- Board values distinguish shared market price from personal value/max bid.
- Prep and live draft modes use the same player board and team panel concepts.
- My Expert and Player News are available as contextual support without making the app feel like separate products.
- Readiness warnings are visible before draft night.
- The first production league supports about 18 concurrent users reading shared state and working privately.
- Unauthorized, non-member, cross-league, and cross-user requests are rejected server-side.

## Test And Verification Strategy

- Component tests for board filters, sorting, player details, team panels, target edits, and mode switching.
- API contract tests for shared reads versus private ownership checks.
- Privacy regression tests for same-league cross-user access and cross-league access.
- Integration test: member logs in, views shared state, saves targets, runs a mock, resumes it, and confirms another member cannot read it.
- Live/prep reuse tests proving live mode consumes live draft state without mutating private mock sessions.
- Accessibility checks for keyboard search, tab navigation, dialogs/drawers, and status announcements.
- Performance smoke test with production-like board size and about 18 concurrent league members.
- Manual draft-night rehearsal covering search, player detail, target list, mock resume, strategy switch, and live draft entry.

## Risks And Open Questions

- Decide whether commissioners can ever view member prep for support; launch default should be no.
- Private overlays can confuse users if shared market price and personal max bid are visually blended.
- Coach responses must cite whether they used shared facts, private prep, or both.
- Draft-night performance may suffer if board, live state, and private overlays are fetched as one heavy payload.
- Decide whether private mock sessions can be exported/imported by users at launch.
- Decide whether saved board views are device-local preferences or server-persisted private artifacts.
