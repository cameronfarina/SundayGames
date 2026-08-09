# Epic 4: League-Calibrated Pricing Model And Model Versioning

## Goal

Make Mockd's expected auction prices a reproducible, versioned model output derived from league-specific history, current market anchors, keepers, roster rules, and strategy overlays. The first launch target is one known league, but the model is league-scoped rather than hard-coded.

## Launch-Critical Scope

- Ingest normalized historical auction records from committed Excel/CSV imports.
- Recompute league calibration from imported history: positional spend, price tiers, keeper inflation, roster shape, owner behavior, and league-specific scarcity.
- Produce a versioned pricing snapshot for every draftable player.
- Keep room-wide market price separate from path-specific personal value.
- Apply keeper removal and inflation scenarios to the open-auction pool.
- Support strategy overlays such as balanced, 3RB, Hero RB, and WR-heavy without mutating the market anchor.
- Feed the shared board, batch simulations, interactive mocks, live draft room values, strategy lab, and audit explanations from the same pricing snapshot contract.
- Persist enough metadata to explain exactly which inputs and model version produced a number.

## Deferred Scope

- Hosted multi-league onboarding UX.
- Generic drag-and-drop import mapping wizard.
- Collaborative multi-user calibration review.
- Automatic paid data-provider ingestion for injuries, depth charts, contracts, and ADP.
- ML-based price prediction.
- Cross-league benchmarking until one league model is validated in production use.
- In-season waiver/trade valuation.

## Data Model Impact

- `projection_snapshots`: provider, scoring format, imported timestamp, source hash, player projection/rank/ADP fields.
- `model_runs`: model run id, league, season, model version, input hashes, status, warnings, created timestamp.
- `pricing_snapshots`: immutable output set per model run and scenario.
- `player_prices`: player-level market price, scenario price, live price, confidence, tier, flags.
- `player_price_explanations`: structured waterfall and source references.
- `strategy_price_overlays`: strategy-specific value/max-bid output keyed by model run, owner/user, strategy, and draft state.

Generated pricing output is immutable. New inputs create a new model run instead of silently changing old values.

## Model Inputs, Outputs, And Versioning

Inputs:

- league settings: budget, teams, roster size, lineup slots, position caps, scoring
- historical auction records from Excel/CSV imports
- current projections, ranks, auction values, and ADP
- keeper declarations and keeper-cost policy
- player identity normalization and manual overrides
- player context evidence: role, injury, environment, schedule, risk, source quality
- owner profiles derived from history
- strategy configuration for path-specific valuation
- live draft state: sold players, remaining budgets, roster needs, scarcity

Outputs:

- base market price before keeper inflation
- scenario-adjusted expected auction price
- live room-adjusted price after actual draft sales
- owner/user/strategy-specific personal value
- recommended max bid
- price tier, positional scarcity, confidence, warning flags
- explanation waterfall with source fields
- batch-ready pricing payload for mocks and simulations

Version keys:

- `modelVersion`: explicit semantic or date-stamped model logic version.
- `inputSnapshotId`: stable hash over normalized inputs.
- `modelRunId`: unique run identifier.
- `scenarioId`: confirmed-only, expected, high-retention, or custom.
- `strategyId`: balanced, 3RB, WR-heavy, etc.
- `explanationSchemaVersion`: debug/audit payload shape version.

Model logic changes require a new `modelVersion`. Data-only changes require a new `modelRunId` and `inputSnapshotId`.

## Recalculation Strategy

1. Historical import changes rebuild league calibration.
2. Projection/rank/ADP changes rebuild base prices.
3. Keeper changes rebuild scenario inflation and auction pool availability.
4. Player evidence or overrides rebuild affected player prices, then reconcile spend totals.
5. Strategy config changes rebuild strategy overlays only.
6. Live draft sales update live values and personal max bids incrementally from the latest immutable pricing snapshot.

For launch, full recalculation is acceptable if it is fast enough for prep. Live draft recalculation should operate from the latest model snapshot plus current room state and avoid expensive historical recomputation.

## Explainability And Debugging

Every visible number should answer: "Why this price?"

Required debug payload:

- input anchors: projection rank, public rank, ADP, auction value
- league adjustments: position multiplier, rank-gap adjustment, historical spend reconciliation, price-tier guards
- keeper effects: removed players, open-auction dollars, inflation factors
- strategy effects: roster path, budget envelope, scarcity/pivot rules, max-bid discipline
- live effects: sold-player deltas, remaining budget pressure, roster scarcity
- source provenance: import file, provider, evidence source, timestamp/hash
- warnings: missing projection, unresolved player identity, weak evidence, outlier versus history, overfit risk

Debug artifacts should support both human-readable audit reports and structured JSON for UI/API consumers.

## API And Contracts

Internal pure contracts:

- `buildLeagueCalibration(inputs) -> LeagueCalibration`
- `buildBasePricing(inputs, calibration) -> BasePricingSnapshot`
- `applyKeeperScenario(basePricing, keepers, scenario) -> ScenarioPricingSnapshot`
- `applyLiveDraftState(snapshot, draftState) -> LivePricingSnapshot`
- `applyStrategyOverlay(snapshot, ownerState, strategy) -> StrategyPricingSnapshot`
- `explainPlayerPrice(snapshot, playerId) -> PlayerPriceExplanation`

External contracts:

- Shared board reads from one pricing snapshot shape.
- Simulations and mock drafts accept `modelRunId`, `scenarioId`, `strategyId`, and seed.
- Live draft values include the model run they were derived from.
- Explanations are fetchable by player, scenario, strategy, and live session.
- Import endpoints return validation errors before model runs are created.

## Dependencies

- Epic 2 for league rules, owner list, keepers, and setup validation.
- Epic 3 for historical imports and player identity resolution.
- Epic 5 and 6 for simulations and mocks that consume pricing snapshots.
- Epic 7 for strategy overlays and budget envelopes.
- Epic 9 for live-adjusted values.
- Epic 10 for persistence, observability, and production jobs.

## Acceptance Criteria

- Historical Excel/CSV imports affect expected auction prices through the same calibration path as current league history.
- Re-running the same model version with the same normalized inputs produces stable outputs.
- Every player board price references a `modelRunId`, `modelVersion`, `scenarioId`, and input snapshot.
- Market price, live price, personal value, and max bid are distinct fields.
- Strategy changes do not mutate the shared league market price.
- Keeper updates remove kept players and recalculate inflation without editing historical records.
- Mock drafts, live draft board, strategy lab, and explanations all consume the same pricing contract.
- The model supports the current production league without hard-coding league-specific constants outside league config/calibration data.
- Outlier and missing-data warnings are visible before draft-night use.

## Test And Verification Strategy

- Unit tests for import normalization, calibration, base pricing, keeper inflation, strategy overlay, and live adjustment.
- Golden tests for known league scenarios and audited player examples.
- Backtests against historical seasons using leave-one-season-out validation.
- Contract tests for shared board, mock engine, live draft room, and explanation payloads.
- Property checks: no negative prices, no duplicate players, total auction spend reconciles, kept players unavailable, max bids respect budget/slots.
- Regression tests for player identity edge cases and import validation failures.
- Performance smoke test for draft-night recalculation latency.
- Readiness command gates for missing keepers, stale projections, failed imports, and model warnings.

## Risks And Open Questions

- Historical data may overfit one league's quirks.
- Public ADP/rank sources can conflict sharply with local market history.
- Player identity matching across imports, projections, and provider feeds is a likely source of silent errors.
- Strategy overlays could become too opinionated if not kept separate from market price.
- Keeper assumptions can create false precision before all owners declare.
- Define acceptable price tolerance for backtests and audited examples.
- Define who can create manual overrides and how they expire.
