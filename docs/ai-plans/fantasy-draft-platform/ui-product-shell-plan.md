# Unified Product Shell And UI Plan

Important: This is the UI/UX plan for making Mockd feel like one product. It does not claim the UI is implemented.

## Problem

The current visible app feels like several tools under one URL:

- Real draft
- Mock draft
- My expert
- Player news
- A separate draft room

That split made sense while the app grew from a local draft board. It does not work for a hosted league prep product. Users need one product that starts with their league, then lets them move between prep, mocks, simulations, strategy, news, expert guidance, and live draft without changing mental models.

## Product Shape

Mockd should have one authenticated shell.

Primary surfaces:

1. `League Home`
   - Shows active league, draft date, setup status, keepers, historical import status, model freshness, and next actions.
   - Commissioner/admin sees setup/import/model actions.
   - Members see readiness, teams, keepers, and prep entry points.

2. `Draft Prep`
   - The main board and team-panel workspace.
   - Search, filters, positions, pricing, keepers, tiers, targets, and player detail.
   - This is the default daily-use surface.

3. `Mock Drafts`
   - Private interactive mock sessions.
   - Uses the same board and team panel components in mock mode.
   - Fresh mock state is explicit. Completed mock results never silently replace the active mock.

4. `Simulations`
   - Private batch simulations and results.
   - Uses saved plans, forced players, target caps, and model snapshots.
   - Results belong only to the user.

5. `Strategy`
   - Private targets, max bids, budget envelopes, avoid list, notes, and saved plans.
   - Can create simulation constraints.

6. `Expert`
   - Private coach/advice surface grounded in shared league state plus the user's private prep.
   - Should also appear as a contextual side panel from player/team/plan views.

7. `News`
   - Player news is a contextual feed tied to board rows, player detail, and roster/target lists.
   - It can have a full feed view, but should not feel like a separate app.

8. `Live Draft`
   - Draft-day mode.
   - Reuses the same board/team panels.
   - Adds room status, share info, commissioner command bar, sale log, undo/correction, SSE/polling status, and export.

## Navigation

Use one left navigation or top navigation inside the authenticated app shell:

- League
- Board
- Mock Drafts
- Simulations
- Strategy
- Live Draft

Secondary/contextual utilities:

- Expert
- News
- Settings

Reasoning:

- `Board` is the center of gravity.
- `Real draft` is not a top-level daily product. It is either `Live Draft` mode or sale logging inside a draft room.
- `Mock draft` is a private practice workflow, not a separate app.
- `My Expert` and `Player News` are supporting context. They should be reachable from the shell, but they should not hide the board/team context by default.

## App Shell Layout

### Logged-Out Shell

- Brand: Mockd
- Login form
- Signup link/form
- Error states for duplicate email, invalid credentials, expired session, and network failure

### Logged-In Shell

- Header:
  - League name
  - Active season
  - User/account menu
  - Draft readiness/status
- Navigation:
  - League, Board, Mock Drafts, Simulations, Strategy, Live Draft
- Main content:
  - Route-specific center panel
- Right rail or drawer:
  - Team panel, player detail, expert, news, or job status depending on context

## Reusable Component Contract

Build reusable components before polishing routes:

- `AppShell`
  - Owns session state, active league/season, navigation, loading/error shell.

- `LeagueHome`
  - Owns shared league status and next actions.

- `BoardWorkspace`
  - Owns board layout and wires mode-specific actions.

- `DraftBoard`
  - Shared player table/card list.
  - Inputs: shared player prices, sold/kept state, private overlays, mode.
  - Outputs: select player, target player, edit max bid, draft/log sale when mode allows.

- `TeamPanel`
  - Shared team/roster/budget panel.
  - Inputs: league teams, keepers, draft state, selected team.

- `PlayerDetailDrawer`
  - Shows price explanation, news, historical context, keeper status, private target/note controls.

- `ContextRail`
  - Hosts Expert, News, selected player, selected team, or job status.

- `CommandBar`
  - Draft commands and mock commands.
  - Mode-specific parser and validation.

- `JobStatusPanel`
  - Shows simulations, imports, model rebuilds, and exports.

## Tomorrow's First Vertical Slice

Build the smallest visible product that proves the platform is real:

1. Login/signup screen backed by existing platform `/accounts` and `/sessions` routes.
2. Persist session through the browser path used by `platformNodeHttp`.
3. After login, show a league home for the seeded/current league.
4. From league home, open a unified board workspace.
5. The workspace should show navigation slots for Board, Mock Drafts, Simulations, Strategy, Expert, News, and Live Draft even if some are disabled or read-only.
6. Reuse existing board/team UI ideas, but make the shell one product.

Acceptance criteria:

- A real browser user can create an account or log in.
- The user lands in the same Mockd shell after refresh.
- The visible shell makes it clear what is shared league truth and what is private prep.
- There is one navigation model. No route should look like a different app.
- Board and team panel are present as the center of gravity.

## Follow-Up UI Slices

### Slice A: Auth And League Home

- Owner: Staff Eng 1 with Staff Eng 8
- Scope: login, signup, session bootstrap, logout, league home shell.
- Depends on: account/session API and seeded league data.

### Slice B: Unified Board Workspace

- Owner: Staff Eng 8
- Scope: board/team shell, app navigation, route layout, shared/private visual language.
- Depends on: active league season and pricing data.

### Slice C: Mock Drafts In The Shell

- Owner: Staff Eng 6 with Staff Eng 8
- Scope: move private mock workflow into the shared board/team shell; make fresh start/reset/result selection explicit.

### Slice D: Simulations And Strategy In The Shell

- Owner: Staff Eng 5 and Staff Eng 7 with Staff Eng 8
- Scope: private simulation jobs/results, saved strategy plans, plan-to-simulation handoff.

### Slice E: Expert And News As Context

- Owner: Staff Eng 7 with Staff Eng 8
- Scope: contextual Expert and News panels tied to selected player/team/strategy.

### Slice F: Live Draft Mode Reuse

- Owner: Staff Eng 9 with Staff Eng 8
- Scope: live room uses the same board/team panels plus commissioner command bar, room status, events, and export.

## UI Non-Goals For The Next Slice

- No marketing landing page.
- No multi-league marketplace.
- No decorative dashboard that hides the board.
- No new design system beyond the minimum needed to unify the existing surfaces.
- No ESPN writeback/import promise.

## Design Principles

- Make the board the product's home base.
- Keep draft-night controls dense, fast, and keyboard-friendly.
- Keep the visual style black, crisp, and restrained with the established neon purple accent.
- Use the same component patterns across prep, mock, and live modes.
- Put private strategy behind clear user ownership boundaries.
- Make errors useful and concrete: budget, roster limit, unavailable player, stale state, unauthorized user.
