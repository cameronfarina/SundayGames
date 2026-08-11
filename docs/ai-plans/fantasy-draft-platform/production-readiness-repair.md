# Production Readiness Repair Plan

Important: This plan is a reference, not a contract. The codebase is always the
source of truth. If merged code contradicts this plan, follow the code.

## Source Snapshot

- Base: `origin/main` at `7a5bbdb46a2c295ab7ab93f6cdfc5d6861ca53d8`
- Integration branch: `codex/production-readiness`
- Integration worktree: `/Users/cameronfarina/personal-projects/Mockd-production-readiness`
- Audited prototype: `codex/live-draft-room-mvp` at `51d2286`, 29 commits
  behind the base, with the hosted room implementation uncommitted.
- Inputs: current code, browser walkthroughs at desktop and mobile sizes, four
  staff audit passes, and the hosted-room prototype.

## Goal

Make Mockd a coherent authenticated product for real league members. A user
must be able to join a league, find their team, prepare privately, enter the
shared live room, follow the same authoritative draft state as every other
member, and recover safely from refresh or connection loss.

## Architecture Decisions

- Platform accounts, memberships, league seasons, and Postgres live rooms are
  authoritative.
- The hosted-room prototype contributes interaction and layout ideas only. Its
  password/token/file repository is not carried forward.
- The existing draft engine remains the rules and projection engine behind a
  runtime league-season adapter.
- Shared league state never includes another user's private shortlist, notes,
  strategy, personal value, or max bid.
- Draft lifecycle is server-owned. `localStorage` may remember harmless view
  preferences but never room state, authentication, or results.
- Live updates use SSE with revision polling as recovery, with visible
  connection status.
- Real draft, private interactive mock, and batch simulation are distinct user
  workflows inside one authenticated shell.

## Implementation Slices

### 1. Canonical live-room contract

- Complete server-owned lobby, countdown, active, paused, complete lifecycle.
- Return role-aware board, roster, budget, event, and connection state from the
  existing platform live-room APIs.
- Adapt runtime league settings instead of static Cam-only configuration.
- Enforce membership and commissioner mutation permissions on every route.
- Add correction, claim-lock, reconnect, and final export behavior.

### 2. Product shell and onboarding

- Implement real signup, login, session bootstrap, league selection, and invite
  acceptance.
- Replace the command-center cards with route-backed League, Board, Mock Drafts,
  Simulations, Strategy, and Live Draft navigation.
- Make League Home show league identity, the user's team, readiness, next draft,
  and role-appropriate actions.
- Move CSV/import tools behind commissioner-only setup flows.

### 3. Draft workspaces

- Preserve the proven player board and team panel as shared workspace
  components.
- Real draft uses the canonical live-room contract and server lifecycle.
- Interactive mock uses the signed-in user's claimed team and a private,
  session-scoped result.
- Batch simulations move to a separate route and stop presenting developer
  script syntax as part of interactive mock drafting.
- Reset, undo, end, retry, and destructive transitions show specific
  confirmation and durable outcome feedback.

### 4. Responsive and accessible operation

- Replace fixed `100vh` and clipped nested panels with an intentional desktop
  workspace and phone layout.
- On phones, prioritize current nomination or latest sale, own team and budget,
  search, and the next available action. Keep the full board secondary.
- Preserve keyboard operation, focus after mutations, labels, live regions,
  reduced motion, and useful error announcements.

### 5. Release gate

- Add browser tests for account creation, invite acceptance, team claim,
  commissioner room creation, start, sale, participant update, reconnect, undo,
  correction, end, export, private mock isolation, and mobile operation.
- Verify anonymous and cross-user access failures.
- Run build, unit/integration suites, two-client desktop E2E, mobile E2E, and a
  staging rehearsal before a domain points at the app.

## Parallel Ownership

| Slice | Write scope | Dependency |
| --- | --- | --- |
| Canonical room backend | `src/platform/liveDraftRoom*`, platform repositories, focused tests | None |
| Product shell | `src/platform/platformShellUi.ts`, shell tests | Stable HTTP contracts |
| Draft and mock workspace | `src/liveDraftUi.ts`, interactive mock model/server paths, focused tests | Canonical identity decisions |
| Hosted room UI | New platform-hosted room UI module and tests | Canonical room DTO |
| Integration and E2E | Server routing, adapters, Playwright, docs | All slices |

Shared files are integrated only by the lead. Workers do not edit outside their
assigned scope without coordination.

## Acceptance Criteria

- A new invited user can create an account, join the correct league, and see
  their claimed team after refresh.
- The production `/draft-room` route opens a populated authenticated room, not
  the app shell or a localhost service.
- Two browsers observe the same lifecycle, sale, undo, correction, roster,
  budget, and final state without exposing private strategy.
- A signed-in member cannot perform commissioner mutations or read another
  user's private mock result.
- Real and mock draft critical paths are usable at 390x844 and desktop sizes.
- A draft survives refresh and temporary network loss without duplicate sales
  or ambiguous committed state.
- The final export is generated from authoritative committed room state.

## Scope Boundary

The first production milestone targets an invite-only league on desktop and
mobile. Multi-league discovery, public league creation, ESPN writeback, and a
marketing site are deferred. The data model and routes must not hard-code the
seeded league or Cam's team.
