# Mockd Launch Readiness Audit

Date: 2026-08-12

This backlog contains only issues reproduced in the browser or confirmed in code with a focused test. Hosted snake drafts remain out of scope. Auction simulations, auction mock drafts, and hosted auction drafts are the launch path.

## Tickets

### 1. [Minimize sensitive browser API responses](https://github.com/cameronfarina/Mockd/issues/1)

Member-facing live-room responses expose internal password references, actor IDs, idempotency keys, mutation hashes, and repository events. Login also returns the bearer token in JSON despite setting an HttpOnly cookie.

Acceptance:
- Browser login responses never contain the session token.
- Live-room bootstrap, GET, mutation, and stream payloads share one public projection.
- Internal authentication and mutation metadata are recursively excluded.
- Commissioner and member contract tests denylist internal keys.

### 2. [Enforce request-body limits on draft-tools APIs](https://github.com/cameronfarina/Mockd/issues/2)

Legacy `/api/*` requests buffer their entire body before parsing and bypass the platform request-size limits.

Acceptance:
- Endpoint-specific limits apply before draft-tools delegation.
- Declared and streamed overflow receive `413` and stop reading.
- Valid existing requests remain compatible.

### 3. [Bound user-controlled resource creation](https://github.com/cameronfarina/Mockd/issues/3)

An account can launch unlimited concurrent mock batches, retain completed jobs indefinitely, and create unlimited leagues.

Acceptance:
- Per-account, per-season, and global mock-batch limits are enforced.
- Queueing is bounded and overload returns `429` or `503` with `Retry-After`.
- Completed jobs have count and time eviction.
- League creation has a durable per-account window and active-league quota that is concurrency-safe.

### 4. [Neutralize spreadsheet formulas in CSV exports](https://github.com/cameronfarina/Mockd/issues/4)

User-controlled names beginning with spreadsheet formula prefixes are exported unchanged.

Acceptance:
- Cells beginning, after whitespace, with `=`, `+`, `-`, or `@` are neutralized.
- League, team, owner, player, and leading-whitespace cases are tested.

### 5. [Make incomplete live drafts recoverable and non-final](https://github.com/cameronfarina/Mockd/issues/5)

The UI permits an incomplete draft to end irreversibly, final exports can be created, and empty teams can receive positive post-draft ranks and strengths.

Acceptance:
- Normal ending identifies and blocks incomplete teams.
- An emergency incomplete ending remains resumable or can be reopened.
- Final export rejects open roster slots.
- Empty or materially incomplete rosters receive no positive rank or strength claims.
- Complete drafts retain the current export and analysis flow.

### 6. [Support multiword owners and teams in live sale entry](https://github.com/cameronfarina/Mockd/issues/6)

Quick-fill inserts full display names, but the sale parser accepts only one owner token.

Acceptance:
- Multiword manager and team names work through quick-fill and manual commands.
- Unique aliases resolve and ambiguous names return a clear selection error.
- Regression coverage includes `Cam Audit` and `Audit Aces`.

### 7. [Validate and reuse historical team mappings](https://github.com/cameronfarina/Mockd/issues/7)

Incompatible 14-team files can be mapped into a four-team league, and the same unmatched owner must be mapped again for every uploaded year.

Acceptance:
- Team-count mismatches are rejected before mapping controls render.
- Each file requires a one-to-one current-team mapping.
- A normalized historical name is mapped once per upload batch and reused across files.
- Tests cover rejected 14-to-4 and accepted multi-year 14-to-14 imports.

### 8. [Keep ESPN import outcomes visible in the setup wizard](https://github.com/cameronfarina/Mockd/issues/8)

At 1280 by 720, ESPN results can render below the scroll boundary and behind the fixed footer.

Acceptance:
- Every result is focused or scrolled into view and is never covered by the footer.
- Private-league failures state that the form was not changed and manual entry remains available.

### 9. [Clarify no-league and invitation onboarding](https://github.com/cameronfarina/Mockd/issues/9)

A new account sees a Draft Lab promise without mock or simulation actions, while invite signup can show `No league memberships found` above a valid invitation.

Acceptance:
- No-league Practice explains board-only access and offers clear Create league and Join from invitation actions.
- Valid invitation routes never show the generic empty-membership message.
- Invitation context survives signup and successful claiming opens the joined league.

### 10. [Make the commissioner team list mobile and keyboard accessible](https://github.com/cameronfarina/Mockd/issues/10)

At 390 pixels, essential columns are offscreen in an unfocusable horizontal table region.

Acceptance:
- Team and manager information is visible responsively, or the scroll region is focusable, labeled, and has an affordance.
- Browser verification covers 390 pixels and keyboard-only navigation.

### 11. [Enforce simulation strategy tiers and closing-budget discipline](https://github.com/cameronfarina/Mockd/issues/11)

`Elite` is parsed but not enforced, and low-value feasible leagues can leave the simulated user with large unused budgets.

Acceptance:
- Elite uses a recorded league-relative rank or value rule.
- Every preference reports a hit, miss, or feasibility warning.
- Feasible auction runs end within one minimum bid of the target budget while explicit caps remain binding.
- Auction and snake tests cover elite enforcement; low-value auction tests cover closing spend.

### 12. [Enforce auction-only hosted rooms at the domain boundary](https://github.com/cameronfarina/Mockd/issues/12)

The main route blocks hosted snake drafts, but direct application entry reaches an untyped auction-settings failure.

Acceptance:
- Application and repository entry points reject snake rooms with a typed conflict before mutation.
- Provisioning returns the same `409` and writes no room, event, or snapshot.
- Snake simulations and interactive mocks remain available.

### 13. [Show keeper-adjusted mock state before draft start](https://github.com/cameronfarina/Mockd/issues/13)

Auction mock setup initially showed a full budget and empty roster, then applied the user's keeper and cost only after Start draft.

Acceptance:
- Setup state already shows keepers, budget left, spent amount, open slots, and max bid.
- Starting the draft does not visually change those initial economics.
- Regression coverage uses a claimed team with a paid keeper.

## Verified Strengths

- Signup logs the user in locally; password hashing, reset-token storage, enumeration resistance, and session revocation passed review.
- Commissioner access is role-gated in the UI and API; private prep is account-scoped.
- Shared league invitation, signup/sign-in, single-team claim, and league switching work.
- Manual league creation, Enter-to-save keepers, publishing, and room creation work.
- Live sale, pause, resume, undo, and multi-browser synchronization work.
- Auction bidding includes scarcity, keeper budget effects, competition, max bids, and complete-roster economics.
- Mock completion/results, shortlist persistence, responsive member views, and pre-draft My Team state work.
- Import file type and expansion limits, invitation token handling, logs, secret validation, and container privileges passed review.
- `npm audit` reports zero known vulnerabilities; 1,082 unit/integration tests passed before remediation.
