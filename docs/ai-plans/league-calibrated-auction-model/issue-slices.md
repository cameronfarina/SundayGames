# League-Calibrated Auction Model Slices

## [1] Normalize Historical Draft Boards

- Type: Task
- Slice category: Foundation
- Owner/team: Mockd
- Affected teams: None
- Belongs to Epic: Yes
- Depends on: None
- Suggested PR boundary: raw CSVs, parser, normalization tests

### Scope

Import 2023-2025 board CSVs and convert them into normalized auction records.

### Behavior

Roster row `1` is keeper data. Rows `2-16` are auction buys, with Owner04's missing 2023 slot filled as a $1 DST placeholder.

### Acceptance Criteria

- Verified row counts and spend totals pass.
- Owner order matches league configuration.
- `DEF` normalizes to `DST`.
- Original and normalized player names are both preserved.

### Notes For Agents

If current code on main contradicts this slice, follow the code.

## [2] Generate Historical Owner Profiles

- Type: Feature
- Slice category: User-facing behavior
- Owner/team: Mockd
- Affected teams: None
- Belongs to Epic: Yes
- Depends on: [1]
- Suggested PR boundary: owner profile model, tests, CLI output

### Scope

Calculate owner spending behavior from normalized historical records using the league's weighted recency model.

### Behavior

For each owner, output weighted spend by position, K/DST depth spend, top-two concentration, $1 player tendencies, keeper context, and profile label.

### Acceptance Criteria

- Defaults use 2023 `20%`, 2024 `30%`, and 2025 `50%`.
- Profile values reproduce the verified handoff numbers within documented rounding tolerance.
- Keeper purchases are excluded from open-auction positional calibration but retained as keeper context.

### Notes For Agents

If current code on main contradicts this slice, follow the code.

## [3] Build Projection Rank Anchor

- Type: Feature
- Slice category: Foundation
- Owner/team: Mockd
- Affected teams: None
- Belongs to Epic: Yes
- Depends on: [1]
- Suggested PR boundary: projection ranking, rank-gap calculation, tests

### Scope

Turn ESPN Weeks 1-4 projection records into draftable-player inputs with ESPN rank, auction value, model rank, and rank gap.

### Behavior

The model transparently labels projection rank as positional order by Weeks 1-4 ESPN applied total.

### Acceptance Criteria

- ESPN position IDs normalize correctly.
- Model rank and rank-gap semantics are tested.
- League `278452` projection caveat is documented without using it for historical prices.

### Notes For Agents

If current code on main contradicts this slice, follow the code.

Status: implemented on `codex/pricing-core`.

## [4] Reproduce Audited Base Pricing

- Type: Feature
- Slice category: User-facing behavior
- Owner/team: Mockd
- Affected teams: None
- Belongs to Epic: Yes
- Depends on: [2], [3]
- Suggested PR boundary: base pricing module, overrides, spend reconciliation tests

### Scope

Generate league-calibrated player prices before keeper removal.

### Behavior

Prices start from ESPN auction value, then apply position multipliers, capped rank-gap adjustment, role sustainability, positional spend reconciliation, and hard ceilings.

### Acceptance Criteria

- Reconciled spend by position matches audited targets.
- Known player examples match expected prices or documented tolerances.
- Owner demand is compressed at market level, not directly multiplied into every player price.
- Optional custom player-context weights can be turned on without breaking positional spend reconciliation.

### Notes For Agents

If current code on main contradicts this slice, follow the code.

Status: implemented on `codex/pricing-core`.
Custom player-context weights implemented on `codex/custom-weights`.

## [5] Apply Keeper Inflation Scenarios

- Type: Feature
- Slice category: Correctness/reliability
- Owner/team: Mockd
- Affected teams: None
- Belongs to Epic: Yes
- Depends on: [4]
- Suggested PR boundary: keeper scenario config and repricing tests

### Scope

Remove keepers from the auction pool and calculate inflation-adjusted open-market prices under editable scenarios.

### Behavior

Confirmed and assumed keeper declarations drive open-auction dollars and positional scarcity, while unannounced keepers remain unassigned.

### Acceptance Criteria

- Keeper costs use the configured keeper-cost formula.
- Scenario inflation factors are deterministic and auditable.
- Known unavailable players are excluded from auction when appropriate.

### Notes For Agents

If current code on main contradicts this slice, follow the code.

Status: implemented on `codex/pricing-core`.

## [6] Simulate Deterministic Auction Drafts

- Type: Feature
- Slice category: User-facing behavior
- Owner/team: Mockd
- Affected teams: None
- Belongs to Epic: Yes
- Depends on: [5], [7]
- Suggested PR boundary: bidding engine, mock generator, validation tests

### Scope

Generate realistic legal auction mock drafts using fixed prices and owner-specific behavior.

### Behavior

Owners bid according to budget, roster needs, position caps, strategy, and historical tendencies.
Owners rotate through synthetic nominations because historical nomination order is unavailable; nomination choices bias elite players early and then react to roster needs, affordability, scarcity, and room-spend pressure.

### Acceptance Criteria

- Every mock has 16 unique players.
- Every mock spends at most $200 and preferably $198-$200.
- Player prices are never mutated downward to force budget fit.
- Picks record the nominating owner separately from the winning owner.
- Seeded RNG produces stable snapshots.

### Notes For Agents

If current code on main contradicts this slice, follow the code.

## [7] Export Auditable Outputs

- Type: Feature
- Slice category: Rollout/validation
- Owner/team: Mockd
- Affected teams: None
- Belongs to Epic: Yes
- Depends on: [6]
- Suggested PR boundary: JSON/CSV export first, Excel export later

### Scope

Produce reviewable outputs from the code model.

### Behavior

The repo emits processed owner profiles, prices, keeper scenarios, mock rosters, and validation summaries as artifacts.

### Acceptance Criteria

- JSON/CSV output is deterministic.
- Generated files are clearly separated from raw inputs.
- Excel export is added only after the model core is stable.

### Notes For Agents

If current code on main contradicts this slice, follow the code.

## [8] Productize After League Fit

- Type: Feature
- Slice category: User-facing behavior
- Owner/team: Mockd
- Affected teams: None
- Belongs to Epic: Deferred
- Depends on: [7]
- Suggested PR boundary: separate future web-app planning epic

### Scope

Generalize the proven modeling core into an app experience for other leagues.

### Behavior

Users can upload auction history, configure rules and keepers, run mocks, and review league-specific prices.

### Acceptance Criteria

- Modeling core supports external league config.
- Import assumptions are explicit and editable.
- Web workflows are designed after the current league model is validated.

### Notes For Agents

This is intentionally deferred until the private league model is credible.
