# Unified Mockd Product Execution

Important: This plan is a reference, not a contract. The codebase is always the
source of truth. If merged code contradicts this plan, follow the code.

## Source Snapshot

- Base: `origin/main` at `116b4a1c5b2a5d6cd5909ab39c120fb08d958f81`.
- Mode: brownfield execution after the user approved a board-first product shape.
- The original checkout is dirty and intentionally untouched. Work runs in the
  clean `codex/unified-product-workspace` worktree.
- Current code, the existing platform plans, and the user's product description
  are the sources for this execution plan.

## Product Contract

Mockd is one league-aware draft workspace. Authentication, league setup,
private preparation, simulations, practice drafts, the shared live draft, and
post-draft team analysis must not look or behave like separate products.

After authentication, the player board is the default surface. A user without
a league sees the current general player baseline and can create or join a
league without losing board context. Adding league settings, historical drafts,
teams, keepers, and owner history enriches that board.

Primary navigation is limited to:

- `Board`
- `League`
- `My Team`

Prep, Mock, and Live are modes of the shared board workspace. Simulation is an
action and results panel. Coach, selected-player detail, news, and simulation
results are contextual rail content.

## Shared And Private State

Shared league truth:

- league format, scoring, roster rules, schedule, teams, and managers
- published keepers and historical draft imports
- league-calibrated market value/rank snapshots
- real live-draft events, rosters, budgets or pick order, and final result

Private user state:

- strategy prompts and structured constraints
- simulations and interactive mock sessions
- shortlist, personal values/ranks, max bids/reach limits, and notes
- coach conversations and recommendations

UI placement never grants access. Server ownership checks remain authoritative.

## League Setup Flow

1. A signed-in user selects `Create league` from the league picker.
2. They paste an ESPN league id or URL and select a season.
3. Mockd attempts an anonymous provider import. Private or unavailable leagues
   move to screenshot/manual confirmation without collecting ESPN credentials.
4. The user confirms draft format, team count, scoring, roster rules, and
   auction or snake settings.
5. They upload a League Members screenshot and map every team/profile.
6. They drop one or more historical `.csv`, `.tsv`, or `.xlsx` results. Mockd
   imports complete standard or wide auction sheets directly and rejects an
   invalid file as a whole with an actionable error.
7. They enter keepers with commands such as `Cam keeping Achane 50`; the number
   means cost for auction and round for snake. Confirmed keepers save
   immediately and remain editable after publication until the draft starts.
8. Applying shared inputs schedules an automatic pricing/ranking rebuild.

## Format Semantics

Auction board values:

- provider auction value
- league market price
- keeper-inflated price
- private max bid
- live room-adjusted price

Snake board values:

- provider ADP
- league expected pick and rank
- private rank and reach limit
- positional tier and live availability

Historical auction calibration compares sale prices with same-season public
auction anchors. Historical snake calibration compares picks with same-season
ADP. Uploaded results alone cannot establish the public historical baseline.

## Shared Workspace Modes

### Prep

Search, filter, sort, inspect, shortlist, set private limits, ask the coach, and
run simulations without mutating shared draft state.

### Mock

The human controls their claimed team. Deterministic AI owners use league rules,
current values, roster needs, and historical tendencies when available. The
same board, team panel, and context rail remain mounted.

### Live

All league members read shared draft state. Commissioners additionally receive
start, pause, pick/sale, correction, undo, end, and export controls. Auction and
snake expose format-specific commands inside the same workspace.

### Post Draft

`My Team` shows final roster rank and explainable strengths/risks. Start/sit
requires fresh weekly projections. Pickup/drop additionally requires a fresh
roster and free-agent snapshot. Missing or stale inputs produce explicit
unavailable states rather than generated advice.

## Current Implementation Facts

- `/board` and `/mock-drafts` render the unified authenticated workspace. The
  legacy adapter falls through for these routes instead of mounting a second
  product.
- League creation imports ESPN settings from an id or URL, accepts a League
  Members screenshot for team and manager names, and provides manual review.
- The setup flow persists auction or snake settings, direct multi-file
  historical auction imports, auto-saved natural-language keepers, and an
  explicit final review before publication.
- The board is public-data capable without a league and becomes league-aware
  when an authenticated user selects a season. Auction values include market
  and personal columns.
- Durable interactive auction and snake mocks support arbitrary 4 to 20 team
  league shapes, deterministic replay, AI owners, keepers, undo, and completion.
- Hosted live rooms support auction sales and snake picks with league-personalized values.
- `My Team` derives final rosters from completed live rooms and gates weekly
  recommendations on current projection data.
- Historical snake calibration remains an explicit rollout boundary rather than
  a partially working control.

## Implementation Slices

1. Generalize persisted league format, scoring, roster, auction, and snake rules.
2. Add ESPN settings review, signed-in league creation, and natural keeper input.
3. Introduce one reusable board workspace and migrate product routes to it.
4. Remove configured-league assumptions from auction draft tools.
5. Add deterministic snake mocks and live pick state.
6. Connect historical imports and keeper changes to automatic model refresh.
7. Add post-draft My Team analysis with freshness-gated coaching.
8. Remove or redirect superseded product pages after behavior parity is proven.

## Verification

- Domain tests for both formats, settings persistence, scoring, and readiness.
- Import tests for public, private, malformed, and ambiguous provider/setup data.
- Contract tests for shared versus private ownership.
- Engine tests for deterministic auction and snake replay, legality, and undo.
- Browser E2E for no-league board, league creation, history/keeper setup,
  simulation, mock, live room, refresh, and post-draft transition.
- Desktop and mobile screenshots with document-overflow and console checks.
- Production image plus Postgres migration/boot smoke and full CI.

## Rollout Boundary

The unified routes replace current user-facing entry points only after their
critical workflows pass E2E. Compatibility redirects remain for old bookmarks.
Production must never advertise weekly coach advice until its readiness checks
pass with real data.
