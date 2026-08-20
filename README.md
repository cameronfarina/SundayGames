# Sunday Games

A web app for fantasy football auction drafts.

Most draft tools price players for a generic league. Sunday Games prices them
for *your* league. It reads the drafts your league already ran, learns what your
managers actually pay, and uses that to value this year's players. Managers plan
their targets, practice against simulated opponents, and run the real auction in
a shared live room.

Runs in production at [sundaygames.io](https://sundaygames.io).

## What it does

**For a commissioner**

- Create a league and a season, then name the teams and their managers.
- Enter keepers and their prices.
- Upload past draft results so pricing reflects real league behavior.
- Send each manager a signup link for their own team.
- Open a live draft room when it is time to draft.

**For a manager**

- Claim your team and see your roster, draft position, and auction budget when applicable.
- Build a target list with your own maximum bids.
- Run simulated auctions to test a plan before draft day.
- Run interactive mock drafts against the simulated room.
- Read player news matched to the players you follow.
- Make picks or record auction buys in the live draft room.

## How it works

Three parts:

- **Web app** (`web/`) — a React single-page app. Login, league setup, practice,
  mock drafts, the live room, and player news.
- **Platform server** (`src/platform/`) — accounts, leagues, seasons, keepers,
  imports, pricing, and the HTTP API. Stores data in Postgres.
- **Draft engine** (`src/liveDraftServer/`, `src/modeling/`) — the auction
  simulation, draft logic, and live room state.

Player prices come from three steps. A public baseline gives every player a
starting value. Your league's imported draft history adjusts those values toward
what your managers really pay. A final step scales the whole board so the prices
add up to the money your league can actually spend.

## Run it locally

```bash
npm install
npm run dev
```

This seeds a demo league and starts the app at `http://127.0.0.1:4319/login`
with hot reload. Sign in with:

- Email: `commissioner@mockd.local`
- Password: `mockd local demo password`

One command runs both the web app and the API. Stopping it stops both.

To change where local data is written, set `MOCKD_PLATFORM_DATA_FILE` or
`MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY`.

## Tests and checks

Run this before every push. It runs what CI runs, in the same order:

```bash
npm run verify
```

The parts, when you want one of them on its own:

```bash
npm test              # server and engine tests
npm run verify:web    # frontend gate: types, lint, tests, coverage, build size
npm run build         # required before the browser tests
npm run test:e2e      # browser tests (run: npx playwright install chromium)
```

`verify:web` requires 100% coverage on the frontend. Any change under `web/src`
needs its branches covered or the gate fails.

The browser tests run against the built server, so a build must come first.
Skipping it tests the previous build and hides real breakage.

Some browser cases run at phone width. A change that only affects narrow
screens can still fail there.

Many tests pin exact user-facing strings. When you change wording, search
`web/src`, `tests/`, and `e2e/` before assuming one edit is enough.

## Deploying

Production runs on Render from the `Dockerfile`.

Push to `main` and the pipeline takes over: CI runs, Render deploys on green,
and a rollback job reverts production if CI goes red. A deploy takes a few
minutes.

The start command lives in the Dockerfile `CMD`, not in `render.yaml`. Render
mis-parses compound commands there, so leave `dockerCommand` unset.

Production needs:

- `DATABASE_URL` — Postgres connection string.
- A writable scratch directory for classic draft-tools session files, with
  `MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY` pointing at it. Do not use a persistent
  disk. A disk stops Render from deploying without downtime.
- `MOCKD_LIVE_DRAFT_DATA_MODE=postgres`.
- Email delivery for signup and password resets (`MOCKD_AUTH_EMAIL_MODE`,
  `RESEND_API_KEY`, `MOCKD_EMAIL_FROM`).
- A versioned ESPN credential keyring. Set
  `MOCKD_LEAGUE_CONNECTION_CREDENTIAL_ACTIVE_KEY_ID` to the active key id and
  `MOCKD_LEAGUE_CONNECTION_CREDENTIAL_KEYS` to a JSON object whose values are
  canonical base64-encoded 32-byte keys. Generate a key with
  `openssl rand -base64 32`; keep the JSON only in the hosting secret store.

Optional: set `MOCKD_SCREENSHOT_IMPORT_MODE=openai` and `OPENAI_API_KEY` to let
commissioners import league members from a screenshot.

Run migrations before serving traffic:

```bash
DATABASE_URL=postgres://... npm run platform:migrate
```

After the encrypted-credential release is stable and every old web instance
has stopped, secure legacy credential rows with
`npm run platform:credentials:backfill`. The command encrypts ESPN credentials,
discards cookie values historically saved on non-ESPN connections, and rewrites
envelopes that still use a retained rotation key. It is safe to rerun.

## Analysis tools

The repository also carries a command-line toolkit used to build and check the
pricing model. These are for development and analysis, not for league members.

```bash
npm run prices        # build player prices
npm run scenarios     # keeper inflation scenarios
npm run mock          # simulate one auction
npm run mocks         # simulate a batch and summarize
npm run backtest      # score the model against past seasons
npm run calibration   # check a batch against economic thresholds
npm run validate      # validate configuration and data
```

Run `npm run` with no arguments to see the full list. Most commands accept
`--scenario`, `--runs`, and `--format`.

## Repository layout

```
web/                  React app
src/platform/         accounts, leagues, pricing, HTTP API
src/liveDraftServer/  legacy live auction engine
src/modeling/         simulation, projections, player news
src/data/             baseline values and player data
config/               league defaults
tests/                server and engine tests
e2e/                  browser tests
docs/                 runbooks and plans
```

## Known limits

- The draft engine still assumes one league shape. It expects a fixed number of
  teams and compares each season's settings against `config/league.ts`. Leagues
  of other sizes cannot open draft tools yet.
- Pricing needs enough draft history to be useful. A league with no imported
  history falls back to the public baseline.
- Once a live draft room exists for a season, team and manager changes are
  locked for that season.
