# League import from sync — session checkpoint (2026-08-19)

## Goal (user request)
Make league sync useful. Connecting ESPN/Sleeper should import EVERY league
under the account, create real Sunday Games leagues 1:1 (teams, scoring,
auction/snake + budget, keeper flag), fast-tracking the wizard. Re-sync should
overwrite the linked league. All imported leagues must show in the header
LeaguePicker / avatar menu. User also wants their pre-existing manual league
to be overwritable by synced data.

## Where work lives
- Worktree: /Users/cameronfarina/personal-projects/Mockd-league-import
  branch claude/league-import off origin/main (45d46ab). node_modules copied
  from Mockd-latest-preview. Repo pushes direct to main (no PRs); run
  `npm run verify` before push; check `git branch --show-current` before
  every commit/push.
- Main /Mockd worktree is STALE and carries another agent's uncommitted work —
  do not use it.

## Exploration findings (3 Opus explorer reports, full text in session transcript)
1. Header/onboarding: LeaguePicker + AccountMenu already handle N leagues.
   GET /onboarding reads leagues+league_seasons+league_memberships only.
   NOTHING links league_connections to real leagues (no FK, no code path).
   Pinned tests enumerated (AccountMenu slice(-3) tail, parityGuard sha256
   count 208, onboarding whole-object toEqual, 150/250-line caps, 100% web
   coverage, missing-test guard).
2. Sync stack: routes /league-connections (+ /discover, /:id/sync). Snapshot =
   SyncedLeagueSettings/Teams/Matchups stored per-connection (migration v18).
   ESPN discoverLeagues = single league only; account-wide listing from
   espn_s2+SWID is NET-NEW (ESPN fan API). Sleeper discover already enumerates
   all leagues by username. Yahoo dark. Snapshot LACKS draft type/budget/
   keeper; espnLeagueSettingsImport (POST /league-imports/espn/review) already
   produces auction|snake + budget + 7-key scoring + rosterSlots + teams for
   ESPN. POST /leagues (ConfirmedLeagueCreationInput) creates real league +
   owner membership; registerLeagueSeason supports overwrite with
   expectedSetupRevision + membershipWriteMode:"preserve"; constraints: team
   count match, no orphaned teams, no live room, scoring 7 named keys, roster
   slots must be in rosterSlotDefinitions (ESPN emits BN/TQB/DL/HC/P/ER which
   throw), snake.order needs internal team ids.
3. League-domain report: requested, not yet received (agent
   explore-league-domain has it ready; ask it to resend if lost).

## Plan shape (draft, not yet written as briefs)
- Slice A (backend): ESPN account-wide league listing from cookies (fan API
  adapter + discover route path when handle is empty but cookies present).
- Slice B (backend): import service — connection+snapshot (+espn settings
  review for draft/scoring richness; Sleeper draft endpoint for draft type/
  budget) → ConfirmedLeagueCreationInput → registerLeagueSeason; store
  connection↔league linkage; re-sync updates linked season (preserve
  memberships, revision check). Human-confirm step for fields providers can't
  supply (per confirmationRequired precedent).
- Slice C (frontend): connect flow becomes "import all my leagues" (multi-
  select of discovered leagues, per-league import status), imported leagues
  appear in picker via onboarding invalidation; connections page gains
  "Import"/"Linked" states; option to overwrite/link an existing manual league.
- Sweep pinned tests per explorer checklist; npm run verify serialized; push
  each slice with its own green CI window.

## Next steps
1. Collect explore-league-domain report (SendMessage to it; it is idle with
   report ready).
2. Write full plan + agent briefs; spawn Opus builder agents (user approved
   the team).
3. Serialize verifies (one npm run verify at a time); lead pushes to main.
