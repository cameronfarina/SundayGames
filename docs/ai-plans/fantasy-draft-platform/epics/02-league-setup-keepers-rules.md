# Epic 2: League Setup, Teams, Owners, Keepers, And Rules

## Goal

Create the league-season foundation for Mockd. Commissioners configure a real fantasy league once, members view shared league context, and pricing/draft systems calibrate from league-specific rules without hard-coded league assumptions.

The first production target is one league with about 18 users, but the implementation must support multiple leagues, seasons, teams, memberships, and rule sets from day one.

## Launch-Critical Scope

- Commissioner-created league season with configurable league name, season year, team count, scoring format, draft type, draft date/time/timezone, and draft-room visibility.
- Auction settings: team budget, minimum bid, nomination order, roster size, lineup slots, bench slots, position maximums, keeper cost policy, and keeper lock deadline.
- Snake settings persisted in the same model: draft order, rounds, reversal type, keeper slot/round treatment. Full snake execution can trail if launch live drafting is auction-only.
- Team and owner setup: team names, owner assignments, co-owners, observers, commissioner role, invite state, claimed/unclaimed teams.
- Keeper setup by manual entry, spreadsheet paste, or CSV upload with preview, validation, player matching, owner matching, status, prior cost, computed cost, and notes.
- Draft countdown and setup readiness state visible to league members.
- Shared league read model: teams/owners, published settings, keepers/prices, calibrated player prices, and active shared model run.
- Setup lock/publish flow so members know when settings and keepers are draft-ready.
- Migration path from current local config files into seeded league-season records.

## Deferred Scope

- ESPN writeback or automated ESPN private-league import.
- Hosted collection/storage of ESPN cookies.
- Full generic import wizard for every provider format.
- Multi-commissioner approval workflows.
- Paid league templates or public league discovery.
- Collaborative live draft mutation by every member; launch can keep one commissioner/admin draft logger.
- Deep keeper-policy variants unless needed by the launch league.
- League-member editing of another user's private strategy, mocks, or personal value model.

## Data Model Impact

- `leagues`: stable tenant boundary.
- `league_seasons`: year-specific rules, draft settings, publish/lock state, active price model run.
- `league_memberships`: user, league, role, invite status, permissions.
- `fantasy_teams`: team display name, draft order/nomination position, archived state.
- `team_owner_assignments`: co-owner and observer support without tying team count to user count.
- `roster_rule_sets`: lineup slots, bench slots, roster size, position minimums/maximums.
- `scoring_rule_sets`: scoring fields needed by projections and calibration.
- `draft_settings`: auction/snake settings plus draft date/timezone/countdown.
- `keeper_policies`: formula, eligibility text, lock deadline, max keepers.
- `keeper_declarations`: season, team, player identity, position, prior cost, computed cost, status, source, notes.
- `league_import_batches`: uploaded/pasted setup file, parser result, validation errors, commit status.
- `draft_room_settings`: visibility, mutation permissions, lock mode, real/practice defaults.

Important modeling shift: current owner literals and static config become runtime IDs. Engines accept `leagueSeasonId`, team IDs, owner display labels, and rule objects instead of importing one hard-coded config.

## API And Contracts

- `POST /api/leagues`: create a league shell.
- `POST /api/leagues/:leagueId/seasons`: create a season from defaults, prior season, or uploaded setup.
- `GET/PATCH /api/seasons/:seasonId/settings`: read/update draft, roster, scoring, and keeper policy.
- `GET/PATCH /api/seasons/:seasonId/teams`: manage teams, owner assignments, and draft order.
- `POST /api/seasons/:seasonId/imports/keepers/preview`: validate CSV/paste keeper data.
- `POST /api/seasons/:seasonId/imports/:importId/commit`: commit validated setup data.
- `GET/PATCH /api/seasons/:seasonId/keepers`: review and edit keepers.
- `POST /api/seasons/:seasonId/model-runs`: recalculate shared calibrated prices from published setup.
- `GET /api/seasons/:seasonId/shared-state`: member-visible settings, teams, keepers, countdown, readiness, and active prices.
- `GET /api/seasons/:seasonId/setup-status`: commissioner-facing validation status.

Contract rules:

- Every read/write is scoped by `leagueId` or `leagueSeasonId`.
- Mutations require commissioner/admin permission unless explicitly enabled for team owners.
- Shared price outputs are immutable by version once published.
- Personal mocks, strategies, shortlists, notes, and private overrides use separate user-scoped APIs and never update shared league state.

## UX Workflows

Commissioner setup:

1. Create or select league season.
2. Choose auction or snake settings.
3. Configure budget, roster slots, scoring, and keeper policy.
4. Add teams and assign owners/co-owners/observers.
5. Set draft date and draft-room settings.
6. Enter keepers manually or import from spreadsheet/CSV.
7. Review validation: missing teams, duplicate players, invalid prices, budget issues, unmatched players, incomplete owner claims.
8. Publish setup and run calibrated prices.
9. Lock settings/keepers before draft night.

League member workflow:

- Accept invite, claim or confirm team association, and view shared setup.
- Review teams/owners, keepers, rules, countdown, and published calibrated prices.
- Run private mocks or strategy work from shared league inputs without exposing results to other members.

Draft-room workflow:

- Draft room reads from the published league season.
- Real room and practice rooms stay distinct.
- Commissioner controls real draft mutations for launch.
- Members view shared board, keepers, teams, countdown, and published prices.

## Privacy Boundaries

Shared within league:

- league name, season, teams, owner display names, roster/scoring/draft settings
- keeper declarations, keeper prices, and published statuses
- published calibrated prices and shared model-run metadata
- real draft-room state

Private to user:

- mock drafts, simulations, strategy labs, target max bids, shortlists, personal notes, private player overrides, and recommendation history
- practice draft sessions unless explicitly shared
- unpublished commissioner setup drafts, except to commissioners/admins

## Dependencies

- Epic 1 for roles, memberships, and private data boundaries.
- Epic 3 for player matching and keeper CSV preview.
- Epic 4 for calibrated prices and model runs.
- Epic 5 and 6 for private simulations and mock drafts that fork from shared league inputs.
- Epic 9 for live draft room setup and draft-room settings.

## Acceptance Criteria

- A commissioner can create a league season without editing TypeScript config.
- Setup supports one league with about 18 users and does not assume user count equals team count.
- At least two test league seasons with different team counts, budgets, and roster rules can coexist.
- Auction settings drive keeper inflation, budgets, roster legality, and draft-room state.
- Snake settings are persisted and validated, even if full snake execution is deferred.
- Keeper CSV/paste import shows a preview with actionable validation before commit.
- Keeper cost formula defaults to `ceil(previousCost * 1.20)` and is configurable.
- Members can view shared teams, owners, keepers, settings, countdown, and published prices.
- Members cannot read another member's mocks, strategies, shortlists, notes, or private overrides.
- Published calibrated prices are tied to an auditable model-run/input version.
- Current local league config can be represented as seeded league-season data.

## Test And Verification Strategy

- Unit tests for rule validation, keeper-cost policy, roster-slot math, and auction/snake setting validation.
- Import parser tests for CSV, spreadsheet paste, duplicate players, unknown owners, bad prices, and unmatched player names.
- Contract tests for commissioner/member/observer permissions.
- Privacy regression tests for cross-league and cross-user access.
- Model integration tests proving league-season settings feed pricing, keeper inflation, and draft-room state.
- End-to-end setup test: commissioner creates season, imports keepers, publishes, member views shared state, member private mock remains private.
- Migration/seed test that reproduces the current local league config and keeper declarations.

## Risks And Open Questions

- Converting current static `ownerOrder`, `Owner`, and `leagueConfig` imports to runtime league-season data may touch many surfaces.
- Confirm whether 18 users means 18 teams or a smaller league with co-owners/observers.
- Decide how much snake behavior must work at launch.
- Define who may edit keepers before lock: commissioner only, team owner, or both.
- Decide whether keeper notes are shared by default or split into public/private notes.
- Choose model-run timing: automatic recalculation on every publish, manual commissioner action, or background debounce.
- Confirm whether published calibrated prices are visible to all league members by default.
