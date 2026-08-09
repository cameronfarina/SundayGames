# Epic 3: Historical Draft Imports And Player Identity Resolution

## Goal

Make historical offline auction drafts easy for commissioners to import from Excel/CSV, review, resolve, and commit as shared league truth in Postgres. Once committed, those sales become durable calibration inputs for expected prices, owner profiles, keeper context, historical priors, backtests, and league-quality gates.

## Launch-Critical Scope

- Commissioner-only import flow for historical auction drafts.
- CSV and Excel upload support.
- Mapping flow for season, owner/team, player name, position, sale price, roster row or keeper marker, and acquisition type when present.
- Support the current wide owner-block board shape used by Mockd historical CSVs.
- Support a normalized row-based template for new leagues.
- Preview parsed rows before commit.
- Player identity resolver with manual review for ambiguous/unmatched rows.
- Import commit writes normalized historical records to Postgres.
- Calibration reads committed Postgres records through the same engine-facing shape currently represented by `HistoricalAuctionRecord`.
- Re-import/replacement workflow for a season with audit history.
- Import summary with counts, spend totals, keeper counts, unresolved players, ignored rows, and validation failures.

## Deferred Scope

- ESPN historical draft import or writeback.
- Direct platform scraping.
- Multi-commissioner simultaneous editing of the same import.
- Automated player identity enrichment from paid providers.
- Full custom import-language inference for arbitrary spreadsheets.
- User-level private annotations on historical sales.
- Cross-league player market sharing.
- Row-by-row undo after calibration jobs have consumed committed imports; launch can support season replacement.

## Data Model Impact

- `historical_import_batches`: league, season, uploader, status, source filename, file hash, MIME type, mapping config, commit timestamps.
- `historical_import_rows`: raw parsed payload, row number, detected owner, player text, position text, price text, keeper/acquisition hints, parse status, validation issues.
- `players`: canonical Mockd player identity, display name, position, provider IDs when available.
- `player_aliases`: alias text, normalized alias, player reference, source, confidence, optional league scope.
- `player_resolution_decisions`: import row, selected player, decision type, confidence, decider, timestamp.
- `historical_draft_sales`: league, season, owner/team, player, original/normalized player names, position, price, roster row, keeper flag, acquisition type, import batch, source row.
- `league_calibration_snapshots`: records which committed import set produced each pricing/calibration run.

Engine boundary:

```text
season,owner,rosterRow,originalPlayerName,normalizedPlayerName,position,price,isKeeper,acquisitionType,source
```

## File And Import Contracts

Accepted launch inputs:

- `.csv`
- `.xlsx`

Supported layouts:

- Current wide board: one season per file/sheet, header contains owner names, each owner block contains price/position/player, roster row identifies keeper row when no explicit keeper column exists.
- Normalized template: `season,owner,player,position,price,roster_row,is_keeper,acquisition_type`.

Canonical output:

- Parsed rows become normalized historical draft rows before validation.
- Raw uploaded file metadata and raw parsed row payload are retained for audit.
- Generated Excel/output artifacts are never source of truth.
- Imports are idempotent by file hash plus league/season unless the commissioner explicitly starts a replacement import.

## Player Matching And Resolution

Resolution order:

1. Provider ID match when present.
2. Existing alias plus position.
3. Exact normalized display-name match plus position.
4. Defense/team normalization, including `DEF` to `DST`.
5. Deterministic alias rules for suffixes, punctuation, nicknames, and common historical variants.
6. Fuzzy candidate list constrained by position and season eligibility.
7. Manual commissioner decision.

Rules:

- Ambiguous matches never auto-commit.
- Manual decisions create reusable aliases unless the commissioner opts out.
- Original uploaded player text is always preserved.
- Canonical player identity is used for calibration, but audit surfaces show original and canonical names.
- Retired, duplicate-name, team-defense, and renamed players must resolve to stable identities across seasons.
- Unmatched players can be committed only as explicit placeholder identities if they do not affect current-player pricing; otherwise resolve before calibration.

## Validation And Error States

Blocking validation:

- missing season
- unknown owner
- invalid or unsupported position
- missing player name
- missing or non-integer sale price
- negative price
- duplicate player within a season unless explicitly marked as correction
- owner roster exceeds configured roster size
- season owner set does not match league configuration unless mapped/acknowledged
- unresolved player rows that affect calibration
- replacement import attempted without confirmation

Warnings:

- season spend does not equal expected league budget total
- keeper count differs from team count
- roster row `1` inferred as keeper without explicit keeper marker
- acquisition type inferred
- fuzzy/manual alias match
- K/DST outlier sale detected
- missing roster slots
- known historical exception carried forward

Import states:

- uploaded
- mapping required
- parsing failed
- validation failed
- resolution required
- ready to commit
- committed
- superseded
- rolled back before commit

## API And Contracts

- `POST /api/leagues/:leagueId/historical-imports`: upload file and create import batch.
- `PATCH /api/historical-imports/:batchId/mapping`: save mapping and re-parse.
- `GET /api/historical-imports/:batchId/preview`: parsed rows, validation summary, unresolved player candidates.
- `POST /api/historical-imports/:batchId/resolutions`: save player resolution decisions.
- `POST /api/historical-imports/:batchId/commit`: atomically write historical sales and supersede prior season import when replacing.
- `GET /api/leagues/:leagueId/historical-draft-sales?season=YYYY`: normalized committed sales.
- `GET /api/leagues/:leagueId/calibration-inputs`: engine-ready historical records.

Imports produce durable league inputs. Pricing and mocks consume normalized records and do not know whether they came from the old local parser or Postgres.

## Privacy Boundaries

Shared league truth:

- league settings
- owners/teams
- historical imported draft sales
- commissioner-approved player aliases
- committed keeper history and acquisition types
- calibration snapshots derived from shared historical sales

Private user data:

- mock draft sessions
- strategy settings
- shortlists/watchlists
- personal max bids
- draft paths and simulations
- private notes
- user-specific uploaded experiments before commit

Only commissioner/admin roles can commit shared historical imports.

## Dependencies

- Epic 1 for roles, membership, and commissioner permissions.
- Epic 2 for owners, roster size, budget, scoring, keeper policy, and supported positions.
- Epic 4 for calibration invalidation/rebuild after committed imports.
- Epic 5 for async parsing and recalculation where needed.
- Epic 8 for commissioner import UX.

## Acceptance Criteria

- A commissioner can upload the existing 2023-2025 Mockd historical boards and reproduce current normalized row counts and spend totals.
- A commissioner can upload a normalized template for a new season without editing code.
- Unmatched or ambiguous players are reviewed before commit.
- Manual player resolutions are reused by later imports.
- Committed imports populate Postgres historical sales and are visible as engine-ready records.
- Owner profiles, base pricing, historical priors, calibration, and backtests run from committed Postgres records.
- Replacing a season creates a new committed import and marks the prior import superseded without deleting audit history.
- ESPN historical import/writeback is absent from the launch path.
- Private mock/sim/strategy data is not written into shared historical draft tables.

## Test And Verification Strategy

- Unit tests for CSV/XLSX parsing, wide-board mapping, normalized-template mapping, price parsing, position normalization, and keeper inference.
- Resolver tests for exact aliases, suffix variants, punctuation variants, DST normalization, ambiguous names, and manual resolution reuse.
- Validation tests for missing columns, unknown owners, duplicate players, invalid prices, roster-size errors, spend warnings, and unresolved blockers.
- API tests for upload, mapping, preview, resolution, commit, replacement, permission checks, and idempotency.
- Migration/schema tests for required constraints and foreign keys.
- Integration test that imports current 2023-2025 boards and compares emitted engine records to existing parser expectations.
- Calibration regression test proving owner profiles/base pricing/backtests read committed Postgres records with unchanged economics.
- Privacy tests proving private mock/session rows are not exposed through league historical import APIs.

## Risks And Open Questions

- Decide how strict launch should be when historical files have incomplete rosters but useful auction sales.
- Decide whether unresolved historical depth players can be placeholder identities if they are no longer active.
- Decide whether season-specific player positions are needed.
- Decide whether manual aliases are global, league-scoped, or promoted after review.
- Choose canonical replacement behavior for an already-committed season: supersede whole season, append corrections, or both.
- Decide how much of the current local CSV parser should be reused.
- Define minimum historical season count for league-calibrated pricing versus generic fallback pricing.
- Decide who can view raw uploaded files after commit.
