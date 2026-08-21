# Manager Draft Profile Slices

## 1. Use and show truthful historical manager profiles in practice auctions

- Type: Feature
- Slice category: User-facing behavior
- Owner/team: Sunday Games
- Affected teams: None
- Belongs to Epic: No; standalone vertical slice
- Depends on: Existing normalized historical imports and live-room membership
- Suggested PR boundary: Domain calculator, frozen mock configuration, practice
  auction card, tests, and landing-copy correction

### Scope

Derive a league-scoped profile from committed prior auction drafts, freeze the
same tendency used by each AI manager, and display it for the current AI bidder
or nominator in the interactive practice auction.

### Behavior

The profile reports auction spending targets, league-relative top-purchase
premium, star-bidding tendency, confidence/sample size, and current players to
watch. It shows an honest insufficient-history state, uses neutral AI behavior
when evidence is sparse, and does not render for snake drafts.

### Acceptance criteria

- No values are invented when historical evidence is missing.
- Every league member can read the shared profiles; outsiders cannot.
- Individual bid telemetry and snake tendencies are not claimed.
- History changes after creation do not alter an in-progress mock.
- Old snapshots and older servers remain compatible.
- Focused, full, live, CI, and deployment checks pass.

### Suggested boundaries

Reuse historical sales, stable owner mapping, immutable season-mock snapshots,
the existing AI tendency, and `AuctionStage`. Do not add a table or endpoint.

### Notes for agents

If current code on main contradicts this slice, follow the code.

## Later candidates from the product-gap audit

These are intentionally conditional until the parallel audit supplies evidence:

- Automatically retain a completed hosted draft as next season's history.
- Replace or qualify any remaining landing-page interaction that the hosted live
  room does not provide.
- Add scheduled-draft visibility and capacity alerts when schedule data is
  complete enough to make the report actionable.
