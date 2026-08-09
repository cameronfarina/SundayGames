# Epic 6: Interactive Mock Draft Engine And Private Mock Sessions

## Goal

Deliver private, fresh, league-calibrated mock draft sessions where a user drafts against AI owners using the same league season data, keepers, rules, historical pricing, calibrated values, and owner tendencies that power real draft prep.

Mock drafts must feel like a real room, support natural commands such as `draft Puka`, and never let a completed or stale draft leak into a new mock session, live room, or batch simulation result.

## Launch-Critical Scope

- Private authenticated mock draft sessions scoped to `(user_id, league_id, season)`.
- Fresh mock creation starts from shared league truth plus selected strategy/scenario, never prior completed state.
- Clear reset behavior:
  - `New mock` creates a new session id with empty commands and a fresh seed.
  - `Reset mock` clears the active session's commands/results after confirmation.
  - `Clear results` removes derived result views without mutating shared league data.
- Interactive auction loop with AI nominations, AI bids, human bid/pass/win decisions, and completed roster results.
- Natural command parsing for `draft Puka`, `Puka 74`, `bid 42`, `pass`, `nominate Puka`, `undo`, `reset`.
- Deterministic replay from command/event log so refreshes rebuild the same mock state.
- Optimistic concurrency using `session_id`, `state_version`, and `command_count`.
- Result views tied to one exact mock session version.
- Hard separation from batch simulations.

## Deferred Scope

- Public or shared mock rooms.
- Multiplayer live mock drafting.
- Draft lobby, invites, comments, or spectator mode.
- Cross-user mock comparison dashboards.
- AI owner chat/personas beyond useful draft behavior.
- Advanced undo history UI.
- Long-term analytics across all private mocks.
- External platform writeback.
- Mobile-native polish beyond responsive web usability.

## Data Model Impact

- `mock_sessions`: user, league, season, strategy, keeper scenario, seed, status, command count, active state version, timestamps.
- `mock_session_events`: append-only ordered events for commands, AI decisions, reset, undo, completion, and derived result invalidation.
- `mock_session_snapshots`: optional latest replay snapshot for fast reload, rebuildable from events.
- `mock_session_results`: derived result payload keyed by `(mock_session_id, state_version)`.

Shared inputs remain league-owned: league rules, owners, keepers, historical boards, calibrated prices, owner profiles, and projection/evidence data.

## Mock Session State Contracts

- Session state is derived from shared league season inputs, user strategy/scenario, seed, and ordered session events.
- Mutations require `session_id`, expected `state_version`, and expected `command_count`.
- Stale mutation attempts return a conflict with the current session summary.
- A completed session can be viewed, duplicated into a fresh session, or reset, but is not reused as the default starting point.
- Starting a new mock never consults latest completed mock unless the user explicitly duplicates one.
- Results are invalidated when commands change.
- Batch simulation results never become the active mock result unless explicitly opened in the simulation workflow.
- Live draft sessions and mock sessions use separate namespaces/tables.

## AI Owner Behavior

- AI owners use keeper-adjusted budgets, roster limits, historical owner profiles, position demand, scarcity, public anchors, and player context evidence.
- Nominations follow deterministic seeded logic with owner needs and league room pressure.
- Bidding uses owner max bids, budget pacing, roster legality, scarcity, and historical aggression.
- AI exposes useful explainable signals: current high bidder, next human bid, top competing AI owner, max/recommended bid, and why price is moving.
- The human-controlled owner is never auto-awarded a player unless confirmed.
- AI owners cannot violate roster slots, budgets, keeper locks, or already-drafted player constraints.

## Command And Result UX

- Primary actions are always visible: `New mock`, `Reset mock`, `Run simulations`, `See results`.
- The command bar accepts natural draft shorthand and resolves fuzzy player names with confirmation when ambiguous.
- `draft Puka` resolves to Puka Nacua when unambiguous.
- Sale commands show the exact logged command before/after acceptance.
- Reset/clear actions require explicit confirmation and display what will be cleared.
- Result pages show source session, strategy, scenario, seed, command count, completion time, and freshness.
- If no current result exists, the UI says so instead of falling back to an older completed draft.
- Simulations use language like `force Puka at $75` and stay visually separate from interactive mock commands.

## Privacy Boundaries

Private to the user:

- mock sessions, commands/events, snapshots, results
- simulation jobs/results
- strategy choices, target lists, notes

Shared within the league:

- league rules
- owner names/profiles
- keeper declarations
- calibrated values
- historical pricing inputs
- live draft room state and final live results

Required invariant: a league member can use shared calibration to run mocks, but cannot read another user's mocks, simulation jobs, commands, or results.

## Dependencies

- Epic 1 for artifact ownership and auth.
- Epic 2 for shared league season, owners, rosters, keepers, and rules.
- Epic 4 for keeper-inflated values and historical pricing.
- Epic 5 for separation from batch simulation semantics.
- Epic 7 for strategy constraints and target lists.
- Epic 9 for shared command grammar and roster validation patterns.

## Acceptance Criteria

- A user can start a fresh private mock and see no commands/results from prior completed mocks.
- A user can draft against AI owners through a complete auction.
- AI owners nominate, bid, and fill legal rosters using league-calibrated behavior.
- `draft Puka` resolves correctly when unambiguous and asks for clarification when ambiguous.
- Reset clears active mock state and invalidates derived results.
- Clear results removes only derived result views.
- Stale tabs cannot overwrite newer mock state.
- Completed mocks remain viewable but do not become default state for the next mock.
- Batch simulations with forced players/prices do not write mock session commands.
- Users cannot access another user's mock sessions or simulation results.
- Live draft state cannot be mutated by mock draft actions.

## Test And Verification Strategy

- Unit tests for command parsing, fuzzy player resolution, roster legality, reset semantics, and stale-version rejection.
- Engine tests for deterministic replay from event logs.
- AI behavior tests for nomination order, bid ceilings, roster/budget constraints, and owner-profile influence.
- Integration tests for create session, mutate session, undo, reset, complete, reload, and result invalidation.
- Authorization tests for cross-user, cross-league, unauthenticated, and non-member access.
- Regression tests proving new mock creation ignores prior completed sessions.
- Separation tests proving simulation forced-sales never write interactive mock commands.
- UI tests for reset confirmation, stale result banners, command entry, and no-results empty states.
- Manual smoke: complete one mock, start a new mock, run simulations, return to mock room, verify no stale completed result appears.

## Risks And Open Questions

- Decide whether reset preserves the same `session_id` with a new generation or creates a replacement session linked to the old one.
- Define how much AI reasoning to expose.
- Decide whether ambiguous commands block with choices or choose best match above a confidence threshold.
- Confirm whether human owner is always the logged-in user's mapped league owner or selectable for practice.
- Determine storage strategy and retention policy for large completed result payloads.
- Confirm whether completed mock sessions are immutable except delete/reset, or editable through undo.
- Clarify UI language around clear/reset/new mock.
