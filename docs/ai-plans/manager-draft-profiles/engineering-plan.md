# Manager Draft Profiles

Important: This plan is a reference, not a contract. The codebase is always the
source of truth. If merged code contradicts this plan, follow the code.

## Source Snapshot

- Mode: brownfield product slice.
- Base: `origin/main` at `80f7ddafb3d83f165bd5bc91c73b70ee6226c91a`.
- Open pull requests inspected: none.
- Existing implementation reused: normalized historical auction sales,
  league-scoped owner identity, the auction mock's historical owner tendency
  calculation, immutable season-mock snapshots, and the practice auction stage.
- The logged-out landing page is the originating product claim. It depicts a
  rival profile read from a league's past drafts.
- The original checkout contains unrelated user changes, so implementation is
  isolated in the `codex/manager-draft-profiles` worktree.

## Frame And Target Behavior

The screenshot says “profile per user,” while the stored evidence is attached
to a stable league owner/team identity. A co-managed team has no historical
bidder attribution. The product will therefore present a **league-scoped
manager/team draft profile**, not a global Sunday Games account profile.

| Landing element | Target product state |
| --- | --- |
| Profile identity | One current league team/owner, matched to historical imports by stable `ownerId`. |
| Targets | The auction positions where that owner historically concentrated more spending than league peers. |
| Historical premium | The owner's median yearly top purchase relative to the league's typical top purchase. |
| Bidding aggression | Truthful “Star bidding” language inferred from winning purchases; never claim bid-by-bid telemetry. |
| Players to watch | Up to two currently available practice-board players whose positions match the historical tendency. |
| Missing history | A clear insufficient-history state with the required next action; no fabricated values. |
| Snake drafts | No auction tendency card. Stored snake history lacks pick number, round, and draft-order evidence. |
| Visibility | Frozen into a private claimed-team mock; the response contains aggregates, not raw historical rows. |

The frame is settled by the runtime contracts: historical sales retain owner,
player, position, price, acquisition type, and season, but not individual bids
or snake pick order. The current auction mock already derives owner tendencies
from winning prices.

## Desired Behavior

- Creating an auction practice mock loads committed prior auction history once.
- Every AI manager uses the exact tendency displayed in its profile.
- The derived profiles and AI tendencies are frozen into the mock's immutable
  configuration, so replacing history later cannot change an in-progress mock.
- The card follows the current AI highest bidder, falling back to the AI
  nominator when the human leads.
- A profile becomes available after two historical seasons and eight
  non-keeper auction purchases. Sparse history produces neutral AI behavior and
  an honest insufficient-history state.
- Players to watch update from the remaining mock board without rereading
  historical records.
- Snake mocks hide the auction-only card.

## Proposed Architecture

1. Add a pure platform `managerDraftProfiles` calculator over
   `HistoricalSaleRecord` and current season teams. It returns a ready or
   insufficient-history profile and the exact premium multiplier used by AI.
2. Load history during season-mock creation and freeze the small derived output
   in the existing immutable configuration snapshot.
3. Replay auction commands from the frozen tendencies and add safe profile read
   models to auction mock responses. Older snapshots default to no profiles and
   neutral behavior.
4. Add a profile card beside `AuctionStage`. The browser derives players to
   watch from the current unsold board plus the frozen target position.
5. Replace broad marketing language that implies individual bid telemetry with
   language the product actually measures.

No database migration is planned: the normalized historical sale repository
already contains the required durable inputs. A new materialized profile table
would create a second source of truth without a demonstrated scale need.

## Calculation Contract

- Exclude keepers, non-auction acquisitions, slot-price placeholders, and owners
  not mapped to a current team.
- Require at least two historical seasons and eight winning auction purchases
  for a ready profile.
- Confidence is limited for two seasons, established for three, and strong for
  four or more.
- Position targets compare median per-season owner auction-spend share with the
  same season's league share; require a 15% lift or label it balanced.
- Premium vs league baseline is available only with six comparable public-price
  purchases and compares owner and league actual/public multipliers.
- Star bidding reuses the engine's median-yearly-top-buy premium multiplier.
  Low is below 0.90, typical is 0.90–1.10, and high is above 1.10.

## Test Strategy

- RED/GREEN domain tests for ready, balanced, insufficient, slot-price, keeper,
  sample/confidence, and league-relative premium behavior.
- RED/GREEN snapshot/HTTP tests proving imported history affects the interactive
  mock, remains frozen after history replacement, and old snapshots stay valid.
- RED/GREEN client/component tests for wire validation, current-manager changes,
  dynamic players-to-watch, insufficient history, and snake absence.
- Production build, architecture guards, focused server/web tests, full quality
  gates, and an independent review/fix/re-review loop.
- Live browser testing for a profiled practice auction, an unprofiled manager,
  and a snake mock before merge.

## Rollout

- Additive snapshot/response/UI fields only; no persistence backfill or
  destructive step.
- An older browser ignores the new response field. A newer browser against an
  older server defaults it to an empty list. A new server replays old snapshots
  with neutral AI behavior.
- Deploy through the existing checks-gated Render service and verify health,
  readiness, auction profile behavior, and snake absence after the old process
  drains.

## Phase Waivers

- The user explicitly delegated product decisions and asked the team to continue
  through completion while away. Synchronous discovery/plan checkpoints are
  waived; code and independent review replace them.
- A separate narrative tech spec and GitHub Epic are waived because this is one
  reviewable vertical slice, not a multi-quarter epic.
- GitHub issue creation is waived. The implementation PR is the execution and
  review artifact.

## Adjacent Findings Boundary

The parallel product audit may identify more missing capabilities. Only issues
that are required to make this profile truthful and usable belong in this PR.
Other verified gaps will be ranked and handed off as independent slices so they
  do not inflate the practice-mock change.

## Explicitly Deferred

Hosted live-room reuse is a follow-up. Hosted auction rooms currently record
commissioner-entered sales rather than autonomous participant bidding, so the
meaning and placement of a manager tendency card there is a separate product
decision.
