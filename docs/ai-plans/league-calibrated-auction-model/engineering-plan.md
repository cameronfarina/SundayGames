# League-Calibrated Auction Model

Important: This plan is a reference, not a contract. The codebase is always the source of truth. If merged code contradicts this plan, follow the code.

## Source Snapshot

- Base branch: `codex/historical-boards`
- Base commit: `941e220`
- Current mode: greenfield product model with one brownfield starter branch in flight
- Current implementation source: TypeScript starter repo plus normalized historical board ingestion
- Local worktree: `/Users/cameronfarina/personal-projects/Mockd-historical-boards`
- Phase waiver: skip full web-app planning for now. The immediate goal is to make the modeling core correct for this league before designing generalized user flows.

## Problem

Generic fantasy-football auction mock tools price a generic market. This league has a long-running, custom auction market with keepers, inflation, owner-specific tendencies, and historically expensive elite-player behavior. A useful mock draft must model this league's market, not a public average.

## Desired Behavior

Mockd should ingest real league history, current projections, keeper declarations, and league rules, then produce reproducible prices and legal mock rosters that match the pressure and spending behavior of this league.

## Vertical Slices

### 1. Historical Board Source Of Truth

Import the 2023-2025 draft boards, normalize the wide owner-block CSVs, identify keeper rows, normalize player names and positions, and preserve source records for audit.

Acceptance criteria:
- Raw board files live under `data/raw`.
- Parser produces one normalized record per roster slot.
- Keeper rows are derived from roster row `1`.
- Verified historical counts and spending totals are locked in tests.

Status: implemented on `codex/historical-boards`.

### 2. Owner Behavior Profiles

Calculate each owner's weighted spending profile from historical boards, separating keeper context from open-auction spending. This becomes the first true league-calibration layer.

Acceptance criteria:
- Owner profile output is derived from parsed CSVs, not pasted JSON.
- 2023/2024/2025 weights are configurable and default to `20%/30%/50%`.
- Position spend, normal K/DST spend, top-two concentration, one-dollar counts, keeper average, and profile labels are generated.
- Verified handoff numbers are covered by tests with reasonable rounding tolerance.

### 3. Projection And Rank Anchor

Load ESPN Weeks 1-4 projections, normalize position IDs, retain ESPN visible rank and auction value, and calculate projection rank gaps transparently.

Acceptance criteria:
- Projection records expose ESPN auction value, ESPN rank, model rank, and rank gap.
- The source league caveat is explicit: projections came from league `278452`, while history is league `100001`; scoring rules are equivalent.
- No historical ownership or price data is taken from ESPN exports.

Status: implemented on `codex/pricing-core`.

### 4. Audited Base Pricing

Anchor prices to ESPN auction value, apply position market multipliers, rank-gap adjustments, sustainability overrides, spend reconciliation, and hard price ceilings.

Acceptance criteria:
- Price calculations are deterministic and test-backed.
- Reconciled open-auction spend matches historical weighted targets by position.
- Known audited examples such as Gibbs, Bijan, Puka, Chase, Josh Allen, and Trey McBride match expected ranges.
- Owner multipliers are not directly applied as large player-price multipliers.
- Optional custom player-context weights can adjust role, injury, contract, coaching, schedule, and bye-week assumptions without changing the default audited baseline.

Status: implemented on `codex/pricing-core`; custom-weight layer added on `codex/custom-weights`.

### 5. Keeper State And Inflation Scenarios

Keep declarations editable, remove kept players from the auction pool, and calculate global plus positional inflation for confirmed-only, expected, and high-retention scenarios.

Acceptance criteria:
- Keeper costs use `ceil(previousCost * 1.20)`.
- Confirmed, assumed, pending, and open statuses are represented.
- Scenario factors are transparent and derived from declared keeper counts and open auction dollars.
- Open-auction assumptions do not assign unannounced players to owners.

Status: implemented on `codex/pricing-core`.

### 6. Auction Simulation Engine

Generate deterministic mock drafts by simulating owners with budgets, roster needs, position caps, owner demand, and endgame behavior.

Acceptance criteria:
- Seeded RNG makes every mock reproducible.
- Rosters contain exactly 16 unique players and spend no more than $200.
- The engine does not mutate player prices to force rosters under budget.
- Bidding behavior uses owner demand dynamically while owners still have budget and need.

### 7. Roster Validation And Lineup Optimization

Validate every mock roster and optimize starters only after the full roster exists.

Acceptance criteria:
- Position maximums and required starters are enforced.
- Week 1 and Weeks 1-4 lineups are optimized independently.
- FLEX is the best remaining RB/WR/TE.
- Bench players never contribute to starter totals.
- The Ray Davis regression stays covered.

Status: starter optimizer and regression test exist.

### 8. Export And Audit Artifacts

Write CSV/JSON outputs first, then Excel once the model is stable.

Acceptance criteria:
- Raw inputs remain source of truth.
- Processed outputs live under `data/processed` or `output`.
- Excel is treated as generated output, not model logic.
- Output includes enough source fields to explain why a price or mock happened.

### 8a. Rich Player Context Inputs

Import or edit player-context signals for role, injury history, contract situation, coaching/scheme, strength of schedule, and bye-week timing. The current implementation supports manual custom weights; future work should attach trusted data sources instead of inventing assumptions.

Acceptance criteria:
- Context sources are auditable per player and category.
- Users can turn context weights on or off.
- Default league pricing remains reproducible when custom weights are off.

### 9. Productization Later

Only after this league's model is credible, generalize toward a web-app flow.

Candidate future capabilities:
- Upload historical auction boards.
- Configure league scoring, roster rules, keeper policy, and owner list.
- Edit keeper declarations and player overrides.
- Run mocks and compare owner/team outcomes in the browser.

Out of scope for the current phase:
- Multi-user auth.
- Payment or SaaS packaging.
- Generic CSV import wizard.
- Public league onboarding UX.

## Current Dependency Map

1. Historical board ingestion unlocks owner profiles.
2. Owner profiles plus projections unlock base pricing.
3. Base pricing plus keeper declarations unlock inflation scenarios.
4. Inflation-adjusted prices unlock auction simulation.
5. Simulation plus validation unlock exports.
6. Only stable exports unlock web-app product design.

## Test Strategy

- Unit-test each modeling layer using small fixtures and the real historical CSVs where appropriate.
- Add regression tests for every handoff correction or known model bug.
- Keep generated Excel out of assertions until the underlying JSON/CSV model is stable.
- Run `npm test -- --run`, `npm run build`, and `npm run validate` for each slice.

## Open Questions

- Which owner labels should be treated as editable versus derived from metrics?
- How close must reproduced owner-profile numbers be to the handoff before we consider the TypeScript model equivalent?
- Should K and DST stay combined for owner-profile behavior, or split for downstream simulation after profile generation?
