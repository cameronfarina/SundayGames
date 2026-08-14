# Mockd

Fantasy-football auction modeling and draft-room application.

## Current state

This repository captures the reusable foundation behind the analysis previously performed in chat:

- 14 teams, $200 auction budget, 16-player rosters
- half-PPR scoring and league roster constraints
- 2026 ESPN Weeks 1–4 projections
- keeper-cost logic (`ceil(previous price × 1.20)`)
- current keeper declarations and assumptions
- projection rank anchors, ESPN ranks, auction values, and rank gaps
- audited pre-keeper prices reconciled to historical open-auction spend
- historical same-player room-clearing priors for league-magnet players whose public anchors are too soft
- optional custom player-context weights for role, injury, contract, coaching, schedule, bye-week, opportunity, defensive-attention, skill-fit, environment, and risk adjustments
- confirmed-only, expected, and high-retention keeper inflation scenarios
- deterministic owner-local auction simulation with scarcity pressure
- strategy-specific team-plan mining from real mock batches, including a true three-RB build for Cam
- strategy-lab comparisons for forced Cam starts like Achane keeper plus Puka, Chase, Cook, Walker, DeVonta, or Ladd paths
- per-owner budget trajectory diagnostics after every sold pick
- nomination decision diagnostics that show why each player was put up for auction
- room-pressure diagnostics that show how deep the legal bidder market was for each sale
- repeatable smoke checks for roster validity, batch validity, and the first two nomination rounds
- structured player price waterfalls from effective public anchor through mock-sale outcome
- prioritized outlier review queues for top-player values that need human attention
- prioritized factual evidence queues for top-player pricing review
- evidence coverage gates that fail loudly when high-priority players have no supporting facts
- calibration gates that mark mock batches as pass, warn, or fail against explicit economic thresholds
- leave-one-season-out historical backtests that separate stable league economics from noisy historical swings
- replacement-depth pricing and budget pacing so owners do not strand themselves into unrealistic $1-only endgames
- high-price volume gates for `$70+`, `$75+`, and `$80+` player counts against historical single-draft ceilings
- roster-shape calibration for QB/RB/WR/TE/K/DST counts so mocks do not hoard backup QBs or special teams
- legal lineup optimization performed **after** the full roster is built
- validation guards for duplicate players, budget, roster size, and position limits
- the current validated Excel model as an output artifact

## Important source-of-truth rules

1. Synthetic 2023–2025 boards provide safe local defaults; ignored private runtime data can replace them for local analysis.
2. The old JSON exports for league 278452 must not be used as historical draft data for this project.
3. Excel files in `output/` are generated artifacts, not the long-term source of truth.
4. Keeper declarations in `config/keepers.ts` should be updated as they arrive.

## Setup

```bash
npm install
npm run dev
```

`npm run dev` seeds the reusable local demo and starts the React app with Vite
and hot module replacement at `http://127.0.0.1:4319/login`. The command prints
a unique frontend runtime ID so a stale process is immediately visible. API,
cookie, and event-stream traffic is proxied to the supervised local platform
process; stopping the command stops both servers. Sign in with `commissioner@mockd.local` and
`mockd local e2e password`; League, Board, Mock drafts, Simulations, and Live
draft all run behind that one authenticated origin and survive a
normal browser refresh. Use `MOCKD_PLATFORM_DATA_FILE` or
`MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY` to change the local storage paths.

The remaining project checks and modeling commands are available separately:

```bash
npm test
npx playwright install chromium
npm run test:e2e
npm run validate
npm run profiles
npm run rankings
npm run prices
npm run prices:custom
npm run prices -- --no-default-evidence
npm run prices -- --player-context=data/raw/player-context.example.csv
npm run prices -- --player-evidence=data/raw/player-evidence.example.csv
npm run audit -- --player="Drake London"
npm run sanity -- --scenario=expected --limit=40 --runs=10
npm run outliers:queue -- --scenario=expected --limit=40 --runs=10
npm run evidence:queue -- --scenario=expected --limit=40 --runs=10
npm run evidence:template -- --scenario=expected --limit=40 --runs=10
npm run evidence:adapt -- --input=data/raw/player-evidence-template.csv
npm run evidence:coverage -- --scenario=expected --limit=40 --runs=10
npm run scenarios
npm run scenarios:custom
npm run scenarios:sensitivity -- --limit=60
npm run mock
npm run mocks
npm run strategy:lab -- --runs=25 --format=markdown
npm run strategy:lab -- --runs=25 --format=markdown --label="Puka plus Walker" --strategy=three-rb --force="Puka Nacua:75,Kenneth Walker III:36"
npm run strategy:lab -- --runs=25 --format=markdown --label="Achane RB caps" --strategy=three-rb --target="Breece Hall:42,Kenneth Walker III:42"
npm run strategy:lab -- --runs=25 --format=markdown --strategy=three-rb --build-around="Omarion Hampton:46-52:2"
npm run teams -- --owner=Cam --strategy=three-rb --scenario=expected --runs=250 --format=markdown
npm run draft:ready -- --owner=Cam --strategy=three-rb --scenario=expected --runs=50 --qa-runs=2
npm run smoke
npm run qa
npm run backtest
npm run calibration
npm run outputs
npm run keepers
```

## Platform E2E

Run the browser readiness smoke with:

```bash
npx playwright install chromium
npm run test:e2e
```

`npm run test:e2e` creates a temporary file-backed platform store, starts
`npm run platform:web` with `MOCKD_PLATFORM_DATA_FILE`, and then runs the
Playwright suite. Pass Playwright flags after `--`, for example:

```bash
npm run test:e2e -- --headed
```

Set `MOCKD_E2E_DATA_FILE=/path/to/platform-store.json` when you want to keep
the seeded store after the run.

To smoke an already deployed platform without starting a local server:

```bash
export MOCKD_E2E_DEPLOYED_COMMISSIONER_EMAIL=commissioner-smoke@example.com
export MOCKD_E2E_DEPLOYED_COMMISSIONER_PASSWORD='secret from the deployment store'
export MOCKD_E2E_DEPLOYED_MEMBER_EMAIL=member-smoke@example.com
export MOCKD_E2E_DEPLOYED_MEMBER_PASSWORD='another deployment secret'
export MOCKD_E2E_DEPLOYED_SEASON_ID=mockd-release-smoke-2026
npm run test:e2e:deployed -- --base-url=https://staging.example.com
```

You can also set `MOCKD_E2E_BASE_URL` or `PLAYWRIGHT_BASE_URL` instead of
`--base-url`. Provision the two smoke accounts, their team assignments, the
published season, catalog, keepers, and draft setup before the run. The deployed
smoke uses invite-only login and normal commissioner actions; it never enables
public signup or calls an HTTP provisioning route. It creates, starts, mutates,
ends, and exports one real room, so each run needs a dedicated season without an
existing draft room.

To seed a reusable local platform store without running Playwright:

```bash
MOCKD_PLATFORM_DATA_FILE=/path/to/platform-store.json npm run platform:seed:e2e
```

## Hosted Platform Production

Use `docs/ai-plans/fantasy-draft-platform/production-runbook.md` for the domain cutover checklist. Do not point a public domain at Mockd until that runbook's go/no-go table is all pass.

Current hosted entrypoints:

```bash
npm ci
npm run build
npm prune --omit=dev
DATABASE_URL=postgres://... npm run platform:migrate
HOST=0.0.0.0 PORT=4319 DATABASE_URL=postgres://... MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY=/var/lib/mockd/draft-tools npm run platform:ready
HOST=0.0.0.0 PORT=4319 DATABASE_URL=postgres://... MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY=/var/lib/mockd/draft-tools MOCKD_SCREENSHOT_IMPORT_MODE=openai OPENAI_API_KEY=... npm run platform:web
DATABASE_URL=postgres://... MOCKD_SIMULATION_DATA_MODE=local-fixtures npm run platform:worker
```

Production uses `DATABASE_URL` plus a persistent volume for account-isolated
board and mock state. `MOCKD_PLATFORM_DATA_FILE` and `platform:seed:e2e` are
local or throwaway-staging tools only. This branch has no production league
seed command yet; use an approved admin/UI/API path before domain cutover.
The hosted scripts execute compiled JavaScript from `dist`, so the runtime
artifact does not need `tsx`, TypeScript, Vitest, or Playwright installed.
The retired `/api/mock-batch` experiment is disabled by default and cannot be
enabled in production. Local engine work can opt in with
`MOCKD_ENABLE_LEGACY_MOCK_BATCH=true`; current Practice simulations and
interactive mock drafts do not use that route.

Commissioners can import ESPN league members from a PNG, JPEG, or WebP screenshot
after the season exists. Set `MOCKD_SCREENSHOT_IMPORT_MODE=openai` and
`OPENAI_API_KEY` on the web service. Optional controls are
`MOCKD_SCREENSHOT_IMPORT_MODEL`, `MOCKD_SCREENSHOT_IMPORT_TIMEOUT_MS`,
`MOCKD_SCREENSHOT_IMPORT_MAX_IMAGE_BYTES`, and
`MOCKD_SCREENSHOT_IMPORT_MAX_CONCURRENCY`. Screenshot import does not collect
manager email addresses. The commissioner reviews every team and maps it to one
existing Mockd profile so account assignments, keepers, and historical behavior
cannot move when the ESPN rows are ordered differently. Create team-specific
signup links from the separate Invitations section after the review is applied;
claimed teams and existing league members cannot receive another invitation.

## Historical Data

The repository defaults to synthetic historical boards under
`data/fixtures/historical`. They retain league-wide prices, positions, player
pool, roster shape, season spend totals, and deterministic model calibration,
but replace manager identifiers with generic owners. They are test and
development inputs, not an identity-bearing league export.

Private exports belong outside the repository. To run local calibration with
private boards, place `2023-board.csv`, `2024-board.csv`, and `2025-board.csv`
in an ignored directory and opt in explicitly:

```bash
MOCKD_HISTORICAL_BOARD_DIRECTORY="$PWD/.mockd/private-source-data" npm run profiles
```

The production image does not include synthetic or private historical boards.
It copies only the approved public projection, evidence, and ranking inputs.
`npm run guard:data` enforces these repository and image-input boundaries in
CI.

The TypeScript parser converts each wide draft-board CSV into normalized records with this schema:

```text
season,owner,rosterRow,originalPlayerName,normalizedPlayerName,position,price,isKeeper,acquisitionType,source
```

Keeper rows come from roster row `1` for each owner. `DEF` is normalized to
`DST`. A missing 2023 sixteenth slot is represented as a $1 post-draft waiver
DST placeholder so season-level economics remain complete.

Removing private files from the current branch does not remove them from prior
Git commits. Purging public Git history and rotating repository visibility are
separate, explicit administrative operations.

## Owner Profiles

Owner profiles are generated from the normalized historical boards with recency weights:

```text
2023 = 20%
2024 = 30%
2025 = 50%
```

Run:

```bash
npm run profiles
```

The profile output includes each owner's weighted open-auction spend by
QB/RB/WR/TE, roster-count tendencies by position, normal K/DST spending,
top-two concentration, $1 player tendency, average keeper cost, and derived
profile label. Known execution-error bids are excluded from normal K/DST
calibration while remaining part of the private source dataset.

The same profile data derives auction behavior knobs used by mocks: position
demand multipliers, price aggression, scarcity chasing, anchor-buy aggression,
depth-buy discipline, and replacement-level patience.

## Projection, Pricing, And Inflation

Run:

```bash
npm run rankings
npm run prices
npm run scenarios
npm run scenarios:sensitivity -- --limit=60
```

`rankings` labels the model rank as the positional order by ESPN Weeks 1-4 `appliedTotal`. Rank gap is `projectionRank - espnRank`, so negative gaps mean the Weeks 1-4 projection order is higher than ESPN's visible PPR draft rank.

`prices` builds pre-keeper prices from uploaded/imported inputs: public auction value anchors, league-calibrated position multipliers, capped rank-gap adjustments, role-sustainability overrides, historical spend reconciliation, and hard position ceilings. The current defaults reproduce this league's audited drafted-pool counts and spend targets, but the engine accepts new historical records and config for future leagues.

By default, `prices` also loads the checked-in 2026 factual evidence file at `data/raw/player-evidence-2026-initial.csv`, applies those sourced opportunity, defensive-attention, skill-fit, environment, and risk signals, and still reconciles the final pool back to historical positional spend. Use `--no-default-evidence` when you need a raw economics-only baseline.

`prices:custom` turns on editable player-context weights from `config/playerContext.ts`. Those weights can move prices for manually configured role, injury, contract, coaching, schedule, bye-week, opportunity, defensive-attention, skill-fit, environment, and risk signals while still reconciling the final pool back to historical positional spend. The default evidence file also loads for custom runs unless `--player-evidence` points at another file or `--no-default-evidence` is passed.

Player-context imports can be layered on with `--player-context=path/to/file.csv` or `--player-context=path/to/file.json`. Passing an import path turns the context layer on, merges the imported rows with the manual overrides, and lets imported category values win for matching normalized player names. CSV imports use this shape:

```text
player,role,injury,contract,coaching,schedule,bye,role_note,injury_note,contract_note,coaching_note,schedule_note,bye_note
```

Each category value is a signed signal multiplied by the configured category weight; notes are optional. JSON imports can be either an array of `{ player, signals, notes }` overrides or an object with an `overrides` array.

Factual player-context evidence can be replaced with `--player-evidence=path/to/file.csv` or disabled with `--no-default-evidence`. Evidence imports are meant for sourced inputs such as target-share deltas, depth-chart changes, coverage difficulty, separation fit, team environment, injury risk, and contract risk. The CSV shape is:

```text
player,category,score,confidence,source,note,provider,source_date,source_quality
```

`category` must be one of `opportunity`, `defensiveAttention`, `skillFit`, `environment`, or `risk`. `score` is the signed evidence signal, `confidence` is optional from `0` to `1`, and the model applies `score * confidence` before category and total caps. `source`, `note`, `provider`, `source_date`, and `source_quality` are preserved in each player's pricing audit so factual inputs can be inspected instead of hidden as assumptions. Existing six-column evidence CSVs still work; the provenance columns are optional. CSV uses `source_date` and `source_quality`; JSON audit and adapter output use `sourceDate` and `sourceQuality`.

Positive evidence is intentionally capped tighter than negative evidence by default: one good news stack should not create a whole extra tier of $75-plus players, but real role, health, environment, or defensive-attention problems can still pull a player down. The base pricing allocator also enforces historical top-price volume limits before keeper inflation so the model can redistribute dollars into the mid-tier without inventing too many elite-price buys.

The initial sourced 2026 evidence set lives at `data/raw/player-evidence-2026-initial.csv` and loads automatically in pricing, scenario, audit, sanity, evidence queue, mock, calibration, QA, and output commands.

`scenarios` removes known keepers from the priced auction pool and applies confirmed-only, expected, and high-retention inflation factors. Scenario counts and average keeper costs are config-driven so unannounced keepers are not assigned to owners.

`scenarios:custom` applies the same keeper scenario logic after custom player-context weights are turned on.

`scenarios:sensitivity` compares confirmed-only, expected, and high-retention assumptions player by player. It shows which players remain auction-available, which named keepers are removed, the scenario-adjusted prices and factors, the price spread between comparable scenarios, and the keeper reason for each removal. `keeperRemovalChanged` flags keeper-status changes by scenario, while `availabilityChanged` is reserved for actual auction-availability changes. Declared keepers outside the priced auction pool are still listed with blank base/scenario prices so their keeper status is visible. High-retention currently uses the same declared confirmed/assumed keeper names as expected, then changes generic keeper counts and inflation pressure; it does not invent extra named keepers without declarations.

Use `audit` when a player number looks weird and you want the bridge in one place:

```bash
npm run audit -- --player="Drake London" --scenario=expected --runs=10
npm run audit -- --player="Drake London" --scenario=expected --player-evidence=data/raw/player-evidence.example.csv
npm run audit -- --player="Drake London" --scenario=expected --no-default-evidence
npm run scenarios:sensitivity -- --limit=60 --format=csv
npm run sanity -- --scenario=expected --limit=40 --runs=10
npm run outliers:queue -- --scenario=expected --limit=40 --runs=10
npm run outliers:queue -- --scenario=expected --limit=40 --runs=10 --format=csv
npm run evidence:queue -- --scenario=expected --limit=40 --runs=10
npm run evidence:queue -- --scenario=expected --limit=40 --runs=10 --format=csv
npm run evidence:template -- --scenario=expected --limit=40 --runs=10
npm run evidence:adapt -- --input=data/raw/player-evidence-template.csv
npm run evidence:coverage -- --scenario=expected --limit=40 --runs=10
```

The audit report includes the effective ESPN anchor, projection rank, ESPN rank, rank gap, league multipliers, context signals and evidence, pre-keeper base price, keeper-inflated scenario price, and the player's observed mock-sale range across the requested runs. Raw ESPN auction values below `$1` are shown separately and floored to a `$1` effective model anchor. The report also includes a structured waterfall that walks from effective ESPN anchor through position multiplier, rank gap, market pressure, projection floor, sustainability, factual context, spend reconciliation, keeper inflation or keeper removal, and mock-sale average when the player is drafted. If the scenario removes the player as a keeper, the report explains why instead of pretending they are still in the auction pool.

The sanity report scans the top auction-available players for review prompts: high mock-sale premiums, large projection lifts versus ESPN rank, expensive players with no factual evidence rows, context penalties, hard-ceiling pressure, and high-price volume against the 2023-2025 historical max counts. Treat those flags as the next evidence queue, not automatic price changes.

`outliers:queue` converts top-player sanity signals into a prioritized review queue for pricing judgment. It flags high mock premiums, mock discounts, wide mock-sale ranges, thin mock demand, large projection rank lifts, public-anchor-to-scenario jumps, hard-ceiling pressure, context penalties, and players contributing to reviewed elite-price volume thresholds. Each row includes the relevant prices, mock range, drafted rate, primary reason, all outlier reasons, thresholds, and a ready-to-run `audit` command for that player.

`evidence:queue` converts those sanity flags into prioritized factual research rows. Each row lists the player, price context, existing evidence count, flags, evidence status, and the exact categories to research: opportunity, defensive attention, skill fit, environment, and risk. Use `--format=csv` when you want a fillable research queue.

`evidence:template` writes a fillable `player,category,score,confidence,source,note,provider,source_date,source_quality` evidence CSV with extra context columns from the queue. Leave rows blank until researched; once `score`, `source`, and `note` are filled, the same file can be passed back through `--player-evidence`.

`evidence:adapt` normalizes a completed local evidence CSV or JSON export back to canonical `player,category,score,confidence,source,note,provider,source_date,source_quality` rows. The first adapter, `scored-local`, is intentionally deterministic: it does not fetch or infer facts, it only validates and strips context columns from completed local research exports. Untouched template rows are skipped, while half-completed rows fail until `score`, `source`, and `note` are filled together.

`evidence:coverage` turns that queue into pass/warn/fail gates for high-priority missing evidence, overall evidence coverage, complete category coverage, and evidence provenance completeness. A failing coverage audit means the pricing model is still allowed to run, but the affected top-player values should be treated as unaudited until sourced evidence rows are added or partial provenance is completed.

## Auction Simulation

Run:

```bash
npm run mock
npm run mock -- --scenario=expected --seed=economic-regression
npm run mock -- --scenario=expected --player-context=data/raw/player-context.example.csv
npm run mock -- --scenario=expected --player-evidence=data/raw/player-evidence.example.csv
npm run mock -- --scenario=expected --no-default-evidence
npm run mocks -- --scenarios=expected --runs=50 --seed-prefix=prep
npm run strategy:lab -- --scenario=expected --runs=25 --format=markdown --seed-prefix=strategy-lab
npm run strategy:lab -- --scenario=expected --runs=25 --format=markdown --label="Puka plus Walker" --strategy=three-rb --force="Puka Nacua:75,Kenneth Walker III:36"
npm run strategy:lab -- --scenario=expected --runs=25 --format=markdown --label="Achane RB caps" --strategy=three-rb --target="Breece Hall:42,Kenneth Walker III:42"
npm run strategy:lab -- --scenario=expected --runs=25 --format=markdown --strategy=three-rb --build-around="Omarion Hampton:46-52:2" --target="Zay Flowers:31"
npm run teams -- --owner=Cam --strategy=three-rb --scenario=expected --runs=250 --strategy-mode=force --format=markdown --seed-prefix=draft-prep
npm run draft:ready -- --owner=Cam --strategy=three-rb --scenario=expected --runs=50 --qa-runs=2 --strategy-mode=force --seed-prefix=draft-ready
npm run smoke -- --scenario=expected --runs=2 --seed=smoke
npm run qa -- --scenarios=expected --runs=2 --seed-prefix=qa
npm run backtest
npm run calibration -- --scenarios=expected --runs=50 --seed-prefix=prep
npm run outputs -- --scenarios=expected --runs=50 --seed-prefix=prep --out=data/processed/mock-prep
```

`mock` runs a deterministic auction from the selected keeper scenario. Declared keepers are locked into their owners' rosters at keeper cost, the auction pool uses scenario-adjusted market prices, and additional $1 replacement players are added from the projection file when the known priced pool is smaller than the remaining roster slots. The output includes `budgetTrajectory`, a per-owner timeline from initial budgets through every sold pick with initial spend, open-auction spend, remaining budget, max bid, roster slots, budget per slot, and position counts. In keeper scenarios, initial spend is keeper spend.

Factual context penalties now travel into mock bidding. A player can still sell above his scenario anchor when the room is cash-heavy or the tier is scarce, but negative context evidence dampens only the over-anchor premium so sourced downside is not immediately bid back into the wrong price tier.

Nominations are synthetic and deterministic because the historical boards do not include reliable nomination order. Owners rotate through nominations, the first phase strongly prefers elite market players, and later nominations adapt to the current nominator's roster needs, opponents' unfilled roster holes, max bid, positional scarcity, and chance to make other owners spend. Each pick records both the nominator and the winning owner.

The auction engine does not globally discount the pool after a few expensive buys. Each owner carries their own remaining budget, remaining roster slots, and max bid, with $1 reserved for every unfilled slot. Budget pacing discounts bids that would strand too little money for future roster slots, mid-auction room pressure lets cash-heavy owners chase good players before the endgame, and endgame pressure pushes owners to spend leftover money late. Late nominators with extra money can also open affordable depth players above anchor, which models real auction budget dumps without globally inflating the room. If two owners spend $80 early, those owners are capped; other owners with full budgets can still bid good players above anchor when comparable talent is scarce. Scarcity pressure now counts bidder depth by same-tier roster capacity and downweights legal backup bidders with low roster interest, so backup QB/TE bidders do not create full starter-tier pressure.

Roster maximums are tuned to this league's historical draft shape: mocks cap owners at three QBs, six RBs, six WRs, two TEs, two kickers, and two defenses so cheap late fillers do not crowd out RB/WR depth. Owner-specific history tightens that further for one-QB and one-TE owners, while owners who historically carried backups can still do it.

Replacement players are no longer a flat $1 shelf. The engine applies a descending replacement-price ladder to QB/RB/WR/TE depth names from the projection file and keeps K/DST replacements at the fallback price, which reduces unrealistic $1-only endgames without making special teams too expensive.

Historical live-auction ceilings from the 2023-2025 boards are now explicit calibration inputs: `$70+` players peaked at 5 in a draft, `$75+` players peaked at 3, and `$80+` players peaked at 1. The engine dampens only the over-anchor portion of elite bids, guards sub-$70 anchors from crossing the `$70` line, and keeps `$70-$71` anchors below `$75`, which keeps top prices from drifting into unrealistic four-or-five-player `$80+` rooms.

Starter-tier guards keep sub-$40 anchors from becoming extra `$40+` sales, which preserves the historical split between starter and strong tiers. Strong-tier guards also keep sub-$60 anchors from turning into extra `$60+` elite sales; high-$50 anchors can still draw a small premium, but they cannot jump an entire tier just because several full-budget owners are bidding.

QB spend has its own controls because this league historically drafts only about 20-24 QBs and does not chase backup quarterbacks at starter prices. The engine dampens QB overbids and applies a moderate backup-QB discount once an owner already has a starter, which keeps QB count realistic without leaving league-wide QB spend too low.

TE spend uses the same shape with lighter defaults: elite TE overbids are dampened, and backup-TE bids are discounted once an owner already has a starter. This keeps the model from drafting too many second tight ends at meaningful prices.

WR spend uses a very light position overbid damper so owner preferences can still chase receivers, while the above-anchor portion of those bids stays closer to the historical league spend mix.

`mocks` runs many deterministic seeds and summarizes the draft-prep signal: player sale ranges, player draft rates, owner spend ranges, owner score ranges, invalid-roster counts, and owner-player exposure. Use comma-separated scenarios, such as `--scenarios=confirmedOnly,expected,highRetention`, when comparing keeper assumptions.

`strategy:lab` compares named Cam draft experiments. The default lab assumes Cam keeps De'Von Achane and then tests exact spend paths such as Puka at `$75`, Puka at `$80`, and Chase at `$70`, plus capped target paths such as Puka plus Walker, elite RB plus Breece/Walker, DeVonta plus Ladd plus Cook, DeVonta plus Ladd plus Walker, and Cook plus Breece/Walker. Use `--force="Player Name:price,Other Player:price"` only for exact what-if starts where Cam is guaranteed to own those players at those prices. Use `--target="Player Name:maxBid,Other Player:maxBid"` for realistic draft-plan tests where Cam wants those players but loses them if the room goes higher. Use `--build-around="Player Name:46-52:2"` or `--build-around="Player Name:46,48,50"` to sweep one anchor player across price points and compare how the rest of the roster changes. `--target` and other `--force` entries can be layered onto each generated build-around scenario. Each scenario reports the forced-start spend, remaining budget, current max bid, target hit rate, target sale range, average Cam rank, Week 1 score, season-strength score, bench depth, dollar-player pressure, and sample builds with starter and bench prices so you can see whether a path is powerful, too thin, or too dependent on a target falling.

`teams` mines complete rosters from real mock batches for an owner and strategy. With `--strategy-mode=force`, the selected strategy is pushed into the auction engine before filtering results; with `--strategy-mode=filter`, the command only finds naturally occurring matches. The Cam true-three-RB strategy targets three startable RBs inside a flexible RB budget envelope, so builds can range from balanced premium RBs to two expensive anchors plus a cheaper third RB when the board supports it. It still caps expensive fourth-RB depth, reserves room for paid WR starters, and reports the actual mock sale price plus the batch sale range for every player. Markdown reports include draft-path recommendations: max price bands, target clusters, pivot rules, dead-zone warnings, and a Strategy Coach section that distills the best sampled rosters into slot price windows, actionable target names, wider market fallback lanes, contingency plans, and risk guardrails.

`draft:ready` runs the draft-day readiness checklist: data inputs, keeper coverage, QA, draft-plan match count, roster validity, and top candidate shape. It exits nonzero only for hard failures, so a `warn` status means there is tuning context to read, not that the prep flow is unusable. Partial keeper coverage is intentionally a warning until every owner decision is represented in `config/keepers.ts`.

`npm run dev` starts the React product locally. Practice, interactive mock drafts, and hosted live auction rooms run inside that application. `src/liveDraftServer.ts` remains an internal API service used by the platform draft-tools adapter; it does not serve a standalone frontend.

The interactive mock panel uses a deterministic snake nomination order, the same player pricing and auction economics as batch mocks, historical owner personality profiles for non-Cam teams, and the selected Cam strategy for personal decision points. When the AI controls a non-Cam sale, it proposes the exact raw command that will be logged to the practice room. When Cam can beat the top AI bid under the selected strategy, the panel pauses with a concrete `Bid $X` action or `Pass`, and shows which AI owner/bid Cam is beating.

`Run mocks` starts a read-only AI-only batch without writing sale commands. The batch varies Cam's strategy across the supported plan families unless a script pins the run to a specific build-around or target constraint, so the results are useful for finding realistic draft paths rather than confirming one fixed plan. Scripts can express constraints such as building around a player at a price range or targeting a player under a max bid. The button becomes a progress bar while simulations run; when it finishes, it changes to `See results` and opens `/mock-results`. That results page has a run selector, a strategy leaderboard, Cam score-range analytics, common Cam roster paths, a 3-by-5 grid with all 14 team drafts plus an AI rankings card, optimized Week 1 starters, player prices, Week 1 estimates, and team Week 1 totals. The AI rankings card labels Week 1 separately from Season strength: Week 1 is the current starting-lineup projection, while Season strength blends full-season starter projection, bench depth, and Week 1-to-season consistency. Each run also explains the projected ranking, Cam's outcome, the best build, and the most fragile build so the grid is more than a pile of rosters.

`smoke` runs a small deterministic mock batch and prints the fastest audit surface for engine changes: invalid-roster counts, first-two-round nominations and prices, average early-round sale-versus-anchor, compact winner/runner-up bid diagnostics, and warnings such as owners leaving too much budget unused.

`qa` is the blessed engine-quality command. It runs one mock batch, smoke report, calibration audit, historical backtest, and advisory evidence coverage pass, then prints a compact JSON report with hard and advisory checks. Hard smoke, calibration, and backtest failures set a nonzero exit code; evidence coverage remains advisory so incomplete research rows are visible without blocking engine verification. Pass `--out=data/processed/mock-prep` when you also want the prep artifacts written.

`backtest` performs a leave-one-season-out historical economics audit. For each 2023-2025 draft, it compares that season's actual open-auction spend, price tiers, high-price volume, roster shape, position spend, and owner spend against the average of the other historical seasons. This is intentionally a league-shape backtest, not a claim that the model can predict past players without historical projection files. Warnings mark naturally noisy areas to keep in mind while tuning; failures mean the historical signal should not be trusted as stable without more data.

`calibration` runs the same batch and compares it against the 2023-2025 historical auction boards by price tier, high-price volume, roster position counts, position spend, owner spend, top-two auction spend, and $1 player volume. The audit includes pass/warn/fail gates for roster validity, auction spend, tier counts, roster counts, position spend, owner spend, and leftover budget so tuning work has an explicit credibility signal. High-price volume gates now check both ceilings and floors, so mocks fail loudly when they create too many elite-price buys or get unrealistically timid at the top. Historical auction spend remains visible as context, but league, owner, and position spend gates target the selected keeper scenario's open auction dollars because keeper costs change the room's available spend year to year.

`outputs` writes the usable prep files:

```text
mock-batch-summary.json
historical-calibration-audit.json
mock-smoke.json
mock-smoke-first-two-rounds.csv
historical-backtest.json
historical-backtest-gates.csv
calibration-summary.csv
calibration-gates.csv
player-sale-ranges.csv
player-outlier-review-queue.csv
player-evidence-queue.csv
player-evidence-template.csv
player-evidence-coverage.json
player-evidence-coverage-gates.csv
keeper-scenario-sensitivity.json
keeper-scenario-sensitivity.csv
owner-summaries.csv
owner-player-exposure.csv
mock-draft-board.csv
mock-bid-diagnostics.csv
mock-nomination-diagnostics.csv
mock-room-pressure-diagnostics.csv
owner-budget-trajectory.csv
price-tier-calibration.csv
high-price-volume-calibration.csv
position-count-calibration.csv
position-spend-calibration.csv
scenario-calibration.csv
```

`mock-draft-board.csv` is the full pick-by-pick board across every run, including seed, scenario, nominator, winning owner, player, position, anchor price, sale price, post-pick budget, and the top three bids.

`mock-bid-diagnostics.csv` is the explainability companion for the draft board. It writes one row per retained top bid with bid rank, owner, amount, max-bid cap status, explicit owner demand, scarcity, room pressure, budget pacing, top-end, position, and context-penalty multipliers, reserve/second-bid/nominator-opening sale resolution, sale-price basis, and the top multiplier drivers.

`mock-nomination-diagnostics.csv` is the nomination companion for the draft board. It writes the top three nomination candidates considered for each pick, with the selected player, candidate count, raw score components, and weighted contributions for market price, projection, nominator need, opponent need, affordability, scarcity, flush-money pressure, and deterministic tie-break.

`mock-room-pressure-diagnostics.csv` is the bidder-depth companion for the draft board. It writes one row per sold player with legal bidder count, bidders at or above reserve/anchor/sale price, cash-heavy bidder count, bidder max-bid summary, and the winning owner's pre-sale budget pressure.

`owner-budget-trajectory.csv` is the budget-timeline companion for the draft board. It writes one row per owner at the initial state and after each sold pick, including the pick context, initial spend, open-auction spend, remaining budget, max bid, roster slots, budget per slot, roster size, and position counts.

When redirecting command output into JSON artifacts, use npm's silent mode:

```bash
npm run --silent prices > data/processed/player-prices.json
npm run --silent prices:custom > data/processed/player-prices-custom.json
npm run --silent scenarios > data/processed/keeper-scenarios.json
npm run --silent scenarios:sensitivity -- --limit=60 > data/processed/keeper-scenario-sensitivity.json
npm run --silent scenarios:sensitivity -- --limit=60 --format=csv > data/processed/keeper-scenario-sensitivity.csv
npm run --silent mock > data/processed/mock-auction.json
npm run --silent mocks -- --scenarios=expected --runs=50 > data/processed/mock-batch-summary.json
npm run --silent smoke -- --scenario=expected --runs=2 > data/processed/mock-smoke.json
npm run --silent qa -- --scenarios=expected --runs=2 > data/processed/qa-report.json
npm run --silent backtest > data/processed/historical-backtest.json
npm run --silent calibration -- --scenarios=expected --runs=50 > data/processed/historical-calibration-audit.json
npm run --silent outputs -- --scenarios=expected --runs=50 --out=data/processed/mock-prep
npm run --silent evidence:queue -- --scenario=expected --limit=40 --format=csv > data/processed/player-evidence-queue.csv
npm run --silent evidence:template -- --scenario=expected --limit=40 > data/processed/player-evidence-template.csv
npm run --silent evidence:adapt -- --input=data/processed/player-evidence-template.csv > data/processed/player-evidence.adapted.csv
npm run --silent evidence:coverage -- --scenario=expected --limit=40 > data/processed/player-evidence-coverage.json
```

The context layer is deterministic and source-driven. Add only player facts you want the model to believe; unsupported contract, coaching, schedule, opportunity, defensive-attention, skill-fit, environment, or risk assumptions should stay empty until you enter or import them from a trusted source.

## Next implementation work

1. Fill and maintain sourced player evidence rows for the high-priority queue.
2. Add richer provider-specific evidence adapters once the local scored adapter is proven.
3. Add a web-app upload flow once the league-specific engine is trusted.
4. Add auth, durable hosted storage, provider adapters, and per-league calibration jobs before opening this to other leagues.

## Push to GitHub

From the directory containing this project:

```bash
git init
git remote add origin git@github.com:cameronfarina/Mockd.git
git add .
git commit -m "Initialize fantasy auction model"
git branch -M main
git push -u origin main
```
