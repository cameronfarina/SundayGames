# Mockd Launch Readiness Audit

Date: 2026-08-12

This backlog contains only issues reproduced in the browser or confirmed in code with a focused test. Hosted snake drafts remain out of scope. Auction simulations, auction mock drafts, and hosted auction drafts are the launch path.

Status: all 39 verified tickets are implemented on the release branch. Final GitHub closure follows the green `main` build.

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

### 14. [Fix generated hosted draft room script parse failure](https://github.com/cameronfarina/Mockd/issues/14)

The generated live-room module contained an incorrectly escaped newline, leaving commissioners and members stuck on the loading state.

### 15. [Add archive lifecycle so league quota counts active leagues only](https://github.com/cameronfarina/Mockd/issues/15)

The active-league quota counted every historical league because no archive lifecycle existed.

### 16. [Keep background mock jobs alive across retained app eviction](https://github.com/cameronfarina/Mockd/issues/16)

Background mock jobs could disappear when enough account and season scopes evicted their retained application instance.

### 17. [Broadcast live draft reopen revisions immediately](https://github.com/cameronfarina/Mockd/issues/17)

Reopening an incomplete draft did not notify connected members until the event-stream timeout.

### 18. [Restore local E2E coverage after API and import hardening](https://github.com/cameronfarina/Mockd/issues/18)

The browser release suite still expected a private live-room field and used an invalid partial-team historical fixture after the production contracts were hardened.

### 19. [Reject cross-origin authentication return paths](https://github.com/cameronfarina/Mockd/issues/19)

A crafted authentication return path containing a backslash could normalize into a cross-origin redirect.

### 20. [Add anti-framing response policy](https://github.com/cameronfarina/Mockd/issues/20)

HTML responses had no framing restriction and could be embedded for UI-redress attacks.

### 21. [Remove OpenAI as a launch-time production dependency](https://github.com/cameronfarina/Mockd/issues/21)

The Render Blueprint still required OpenAI screenshot analysis even though the launch product uses manual commissioner entry and should not require an API key.

### 22. [Fix transactional production provisioning apply](https://github.com/cameronfarina/Mockd/issues/22)

A clean production provisioning document passed dry-run but failed during apply while recording its audit receipt, blocking the documented recovery path and a real restore rehearsal.

### 23. [Hide unavailable screenshot analysis from league setup](https://github.com/cameronfarina/Mockd/issues/23)

Disabling screenshot analysis still left upload controls visible in the league wizard, advertising a workflow that could only fail after submission.

### 24. [Run screenshot E2E only when analysis is enabled](https://github.com/cameronfarina/Mockd/issues/24)

The browser release suite still ran screenshot-only scenarios in the default manual setup mode, where those controls are intentionally absent.

### 25. [Bound durable interactive mock sessions](https://github.com/cameronfarina/Mockd/issues/25)

Authenticated members could create unlimited durable interactive mock sessions, continually growing the shared platform snapshot and its serialization cost.

### 26. [Disable or strictly bound the legacy mock-batch endpoint](https://github.com/cameronfarina/Mockd/issues/26)

The unused authenticated legacy mock-batch endpoint retained large complete results and could pin application scopes until the web process exhausted memory.

### 27. [Exercise mutating product flows against production Postgres](https://github.com/cameronfarina/Mockd/issues/27)

The production-container CI job verified migrations and process health, but did not prove that signup, league mutations, keepers, hosted auction sales, and reloads persisted through the production Postgres composition.

### 28. [Enforce interactive mock quotas when resetting sessions](https://github.com/cameronfarina/Mockd/issues/28)

Completed interactive mocks could be reset to active without rechecking the per-user and per-season active-session quotas.

### 29. [Let users abandon active interactive mocks](https://github.com/cameronfarina/Mockd/issues/29)

Users could exhaust their active mock allowance but had no HTTP or product action to abandon an unfinished mock and immediately release capacity.

### 30. [Bound interactive mock command logs](https://github.com/cameronfarina/Mockd/issues/30)

One authenticated interactive mock could retain an unlimited command history and continually enlarge durable shared snapshots despite the session-count bounds.

### 31. [Add local browser coverage for simulation results and history](https://github.com/cameronfarina/Mockd/issues/31)

Simulation submission, per-run league results, Week 1 estimates, and saved history were exercised only by a deployed smoke path, leaving the local release gate incomplete.

### 32. [Add browser coverage for completed mock results](https://github.com/cameronfarina/Mockd/issues/32)

The local browser suite started and advanced an interactive auction mock but did not finish it or assert the all-team results grid.

### 33. [Add browser coverage for abandoning and replacing a mock](https://github.com/cameronfarina/Mockd/issues/33)

The abandon flow had HTTP and generated-UI tests but no executable browser regression for confirmation, recovery focus, quota release, and replacement-session creation.

### 34. [Prevent pending-account signup pre-hijacking](https://github.com/cameronfarina/Mockd/issues/34)

Repeated signup for an unverified email could reissue verification while retaining the first signup password hash, allowing an attacker-controlled credential to survive the victim's verification.

### 35. [Disable or bound legacy scratch draft sessions in production](https://github.com/cameronfarina/Mockd/issues/35)

Authenticated members could allocate unlimited persistent scratch draft stores and process-map entries outside the newer interactive mock quotas.

### 36. [Disable invalid mock nominations for unfillable roster positions](https://github.com/cameronfarina/Mockd/issues/36)

Interactive auction mocks could present an enabled nomination action for a player position that could not fill the controlled team's remaining roster slots, then fail with a predictable `409` after the click.

### 37. [Bound live-draft event-stream connections and clean up disconnects](https://github.com/cameronfarina/Mockd/issues/37)

Authenticated members could open unlimited live-room long polls, and disconnected requests retained their waiters until timeout.

### 38. [Bound live-room snapshot growth and mutation churn](https://github.com/cameronfarina/Mockd/issues/38)

Repeated commissioner mutations persisted complete room snapshots containing accumulated events and static draft data, creating superlinear Postgres growth.

### 39. [Bound and expire historical import preview resources](https://github.com/cameronfarina/Mockd/issues/39)

Historical imports were parsed before import-specific admission checks, had no row or cell cap, and retained an unbounded number of durable previews.

## Verified Strengths

- Signup logs the user in locally; password hashing, reset-token storage, enumeration resistance, and session revocation passed review.
- Commissioner access is role-gated in the UI and API; private prep is account-scoped.
- Shared league invitation, signup/sign-in, single-team claim, and league switching work.
- Manual league creation, Enter-to-save keepers, publishing, and room creation work.
- Live sale, pause, resume, undo, and multi-browser synchronization work.
- Auction bidding includes scarcity, keeper budget effects, competition, max bids, and complete-roster economics.
- Mock completion/results, shortlist persistence, responsive member views, and pre-draft My Team state work.
- Import file type and expansion limits, invitation token handling, logs, secret validation, and container privileges passed review.
- `npm audit` reports zero known vulnerabilities; 1,184 unit/integration tests pass after remediation.
- The assembled browser release gate covers commissioner and member onboarding, imports, simulations, mock auction, hosted auction, realtime updates, mobile layouts, keeper persistence, and incomplete-draft recovery.

## Final Verification

- `npm run build`: passed.
- `npm test`: 145 files, 1,186 tests total, 1,184 passed, and two production Postgres integration tests skipped locally and delegated to CI.
- `npm run test:e2e`: 12 browser scenarios passed; two deployed-only smoke scenarios skipped locally.
- `npm audit --audit-level=high`: zero known vulnerabilities.
- `render.yaml`: valid against the checked Render Blueprint schema.
- Production Postgres composition coverage exercises signup, verification, login, league and keeper mutations, hosted auction sales, restart, and persistence in CI.
- A local container restore rehearsal could not run because the existing Docker daemon was unresponsive. The repository restore tests pass, but a managed backup and restore rehearsal remains a hosting operation before public launch.

## Product Roles And Scope

- The Commissioner navigation is visible only to an owner or admin of the active league. API authorization independently enforces the same boundary.
- Any signed-in user can create a league and becomes its commissioner. Invited members use Practice, League, and My Team after claiming a team from the shared league link.
- League imports, keeper administration, invitations, publishing, and hosted auction controls are commissioner actions. Shortlists, simulations, and interactive mocks are private to each signed-in account.
- Snake preparation, simulations, and interactive mocks are available as beta workflows. Hosting a real snake draft is intentionally disabled and is not part of this launch.
