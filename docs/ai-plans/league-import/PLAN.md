# League import from sync — engineering plan and shared contract

Owner: team lead (main session). Builders: backend agent, frontend agent.
Read STATE.md for background. This document is the single source of truth
for the cross-slice contract. If you must deviate, message the lead FIRST.

## Product goal

Connecting a provider account imports the user's leagues as REAL Sunday
Games leagues, 1:1:

1. ESPN: paste espn_s2 + SWID → list ALL the account's leagues (no league
   id needed). Sleeper: username already lists all leagues.
2. Each discovered league can be imported: creates a real league via the
   existing creation domain (teams, scoring, auction/snake + budget,
   keeper flag), fast-tracking the wizard. Imported leagues appear in the
   header LeaguePicker / avatar menu (onboarding invalidation).
3. A connection remembers which Sunday Games season it produced.
   "Sync now" refreshes the snapshot AND updates the linked season
   (safe subset — see below).
4. Import can OVERWRITE an existing league the user manages (their
   manually created league) instead of creating a new one.

## Architecture decision

Join the two existing halves. Do NOT build a new creation path.

- Discovery/snapshot half: src/platform/leagueSyncService + adapters
  (src/data/leagueSyncProviderAdapters) + league_connections tables.
- Creation half: ConfirmedLeagueCreationInput →
  createLeagueSeasonFromConfirmedSetup → app.registerLeagueSeason
  (src/platform/leagueCreation, src/platform/http/routes/leagues.ts).
- Overwrite half: teamMapping identity preservation from
  src/platform/leagueSetupImport (match by name, then draft slot; keep
  existing team ids so keepers/claims survive).

## Wire contract (frozen — both builders code against this)

### 1. Extended SyncedLeagueSettings (adapter contract + snapshot + web zod)

Add OPTIONAL fields to SyncedLeagueSettings in
src/data/leagueSyncProviderAdapters/contracts.ts (and snapshotCodec, and
web syncedLeagueSchema):

```ts
draftType?: "auction" | "snake" | undefined;
auctionBudget?: number | undefined;      // dollars
minimumBid?: number | undefined;         // dollars
snakeRounds?: number | undefined;
keeperCount?: number | undefined;        // > 0 means keeper league
```

Sources: ESPN payload.settings.draftSettings (type AUCTION/SNAKE,
auctionBudget, keeperCount) — the mSettings view already arrives.
Sleeper: GET /v1/league/{id}/drafts (type snake|auction|linear → treat
linear as snake; settings.rounds, settings.budget) and league
settings.max_keepers for keeperCount. Absent data stays undefined.

### 2. ESPN account-wide discovery

POST /league-connections/discover with
`{ provider: "espn", handle: "", espnS2, swid }` (blank/absent handle,
both cookies present) returns ALL of the account's fantasy football
leagues for the requested season, via ESPN's fan profile API
(https://fan.api.espn.com/apis/v2/fans/{SWID} with the same cookie
header; filter to game ffl and the requested season). Response shape
unchanged: `{ leagues: DiscoveredLeague[], provider, season }`.
Blank handle without both cookies → LeagueSyncError "credentials_required".
The existing single-league handle path keeps working.

Provider catalog: add field `supportsAccountDiscovery: boolean`
(espn true, sleeper true, yahoo false) so the frontend can branch.
Sweep catalog-pinning tests + web provider zod schema.

### 3. Connection ↔ league linkage

New nullable column `league_season_id text` on league_connections,
FK → league_seasons(id) ON DELETE SET NULL. New migration id
`platform-league-import-v19` appended after v18 in
ownershipDefinitions (additive ALTER ... ADD COLUMN IF NOT EXISTS).
In-memory repository gains the same field. Repository interface gains
`linkConnectionToSeason(id, leagueSeasonId)` and returns the linkage in
LeagueConnection as `leagueSeasonId?: string`.

publicConnection adds, when linked:
```ts
importedSeasonId?: string;
importedLeagueSlug?: string;   // resolved from the season's league
importedLeagueName?: string;
```
(Resolve slug/name server-side at list/read time; if the season vanished,
omit all three.) Web leagueConnectionSchema adds the three as .optional().

### 4. Import route

POST /league-connections/:id/import
Body: `{ mode: "create" }` or `{ mode: "overwrite", seasonId: string }`.
Auth: requireRequestAccount; connection must belong to the account.

Behavior:
- Needs a stored snapshot (409 `snapshot_required` "Sync this league
  before importing it." if none).
- Converts snapshot (+extended settings) → ConfirmedLeagueCreationInput
  (see conversion rules). Conversion problems → 422
  `{ code: "import_needs_review", message, issues: string[] }` with
  plain-language issues ("ESPN roster slot HC is not supported.").
- mode create: if already linked → 200 idempotent with existing linkage.
  Otherwise app.registerLeagueSeason with the actor as owner membership
  (same as POST /leagues). Skip the per-hour creation rate limit for
  provider imports but KEEP the 20-active-league quota (extend the
  register input with an explicit flag; do not silently drop limits).
- mode overwrite: season must exist, actor owner/admin, NO live draft
  room (409 league_setup_locked), setupStatus must be "draft" OR the
  draft format must match (assertDraftFormatUnchanged fires otherwise —
  surface it plainly). Build the new season from the existing one:
  keep season.id, league.id, slug; replace league name/provider/
  externalLeagueId; replace settings from conversion; rebuild teams with
  leagueSetupImport-style identity matching (keep matched team ids /
  ownerIds); membershipWriteMode "preserve"; expectedSetupRevision from
  the freshly read season.
- Both modes: persist linkage, return
  `200 { connection, imported: { seasonId, leagueId, leagueSlug, leagueName } }`.

### 5. Re-sync updates the linked season

At the end of a successful syncLeagueConnection, when the connection is
linked: apply a SAFE update to the season — league/season name, scoring,
roster rules, keeper flag, and team DISPLAY data (names, abbreviations,
managers) matched by teamMapping logic. NEVER delete or add teams during
re-sync; if the provider team count differs from the season's, set the
connection to needs_attention with a plain statusDetail instead. Skip
draft-format changes when locked (published) — statusDetail explains.
Update failures must not fail the sync: snapshot still saves; the
connection carries the message.

## Conversion rules (snapshot → ConfirmedLeagueCreationInput)

- provider: connection.provider; externalLeagueId: providerLeagueId;
  leagueName: settings.name; seasonYear: Number(settings.season) —
  reject non-4-digit with an issue.
- expectedTeamCount: settings.teamCount; must be 4..20 or issue.
- teams: from snapshot teams — externalTeamId: providerTeamId,
  displayName: name, managerNames: ownerNames, abbreviation omitted.
- scoring: map snapshot keys {pass_yd→passingYards, pass_td→passingTouchdown,
  rush_yd→rushingYards, rush_td→rushingTouchdown, rec_yd→receivingYards,
  rec_td→receivingTouchdown, rec→reception}. Missing yardage/rec → 0.
  Missing TD values → default (4/6/6) — server requires TD > 0; a
  provider TD value <= 0 becomes an issue, not a silent default.
- rosterSlots: count settings.rosterPositions into a record, translating
  aliases first: BN→BENCH, REC_FLEX→WR_TE, TAXI→(drop, warning),
  IR→IR. Then pass through the server's normalizedRosterSlotKey
  vocabulary (QB RB WR TE K DST/D_ST FLEX/RB_WR_TE RB_WR WR_TE OP
  SUPERFLEX BENCH IR). Any slot that still doesn't normalize →
  issue naming the slot (import blocked for that league, others fine).
- draft: draftType auction → { type:"auction", budgetDollars:
  auctionBudget, minimumBidDollars: minimumBid ?? 1 } (budget must
  satisfy budget >= rosterSize * minimumBid — else issue).
  draftType snake → { type:"snake", rounds: snakeRounds ?? draftable
  slot count, order: team external ids in snapshot order }.
  draftType undefined → issue "Could not read the draft type from
  <provider>. Open the league wizard to finish setup." (v1: blocked;
  the wizard remains the fallback).
- keeperLeague: keeperCount !== undefined && keeperCount > 0.

## Slice split

### Backend agent — worktree /Users/cameronfarina/personal-projects/Mockd-league-import (branch claude/league-import)
1. Adapter contract extension + ESPN draft/keeper settings + Sleeper
   drafts endpoint + snapshot codec + fixtures.
2. ESPN fan-profile account discovery + catalog field + discover route
   blank-handle path.
3. Migration v19 + repository linkage (postgres + in-memory).
4. Conversion module (new, e.g. src/platform/leagueImportFromSync/ —
   every module ≤150 lines).
5. Import route + re-sync linked-season update + publicConnection
   enrichment.
6. Backend tests: unit for conversion (both providers, issue cases),
   route tests (create/overwrite/idempotent/guards), sync-update tests,
   migration test sweep (tests/platformMigrations*, blueprint pins),
   onboarding untouched.

### Frontend agent — worktree /Users/cameronfarina/personal-projects/Mockd-league-import-web (branch claude/league-import-web)
1. ESPN connect flow: cookies-first "Find all my leagues" primary path
   (espn_s2 + SWID fields up front, blank handle), league-ID path kept
   as secondary. Sleeper flow unchanged.
2. Discovered list: per-league "Connect and import" plus "Import all"
   (sequential: connect → import per league; per-league status lines;
   plain-language failures from import_needs_review issues).
3. Connection cards/detail: imported connections show "Open in Sunday
   Games" linking to /leagues/{importedLeagueSlug}; unimported show
   "Import"; import offers "Create new league" (default) or "Replace an
   existing league" (select from onboarding leagues the user manages).
4. Cache: import success invalidates onboarding + league-connections
   queries (picker updates).
5. Empty state: NoLeague (LeagueState.tsx) gains a second line linking
   to /connections ("import the leagues you already play in").
6. Zod schema updates per contract (§1 optional synced fields, §3
   connection fields, catalog supportsAccountDiscovery).
7. Web tests: 100% coverage on all touched branches; sweep pinned
   literals (ConnectionsPage tests, connect test near 250-line cap —
   decompose; ConnectedLeaguesCard; routeMetadata untouched; DO NOT
   add avatar-menu items or routes — reuse /connections).

## Team rules (from hard-won incidents — non-negotiable)

1. Work ONLY in your assigned worktree. Run `git branch --show-current`
   before EVERY commit. Never `git stash`. Never switch branches.
2. NEVER push. The lead integrates, runs the full `npm run verify`, and
   pushes to main. Pushes deploy production.
3. Run TARGETED tests only (single vitest/test files). Do not run
   `npm run verify` or the e2e suite — the lead serializes those.
4. Verify cross-slice behavior against THIS contract document, not
   against anyone's summary. If the contract is wrong, message the lead.
5. Every new shipped module (src/ and web/src) has a HARD 150-line cap
   (tests/repositoryTypeScriptArchitecture.test.ts). Decompose early.
   No `as` casts, no `any`, no `!`, no ts suppressions (guards enforce).
6. Web coverage gate is 100% on all four metrics for web/src changes.
   New web modules need a colocated test or an exemption entry.
7. User-visible strings: sweep web tests, tests/ (backend), e2e titles.
   Do not touch e2e/platform-readiness/** (parityGuard sha256) unless
   unavoidable — if you must, tell the lead.
8. Report completion to the lead (SendMessage to "main"): commit SHAs,
   files touched, test commands run with pass evidence, open issues.
   Commit messages follow repo style (short imperative, no branding).
