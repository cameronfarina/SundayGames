# Epic 9: Live Draft Room, Realtime SSE, And Commissioner Workflow

## Goal

Productionize Mockd's live in-person draft room as shared league state. A commissioner starts a real draft room from a published league season, league members join and select/view teams, and everyone sees board, rosters, budgets, sale log, and live pricing update in realtime from Postgres-backed draft events and projections.

## Launch-Critical Scope

- Commissioner-created live draft room from a published `league_season`.
- Auction-first live room using published league rules, teams, keepers, roster settings, budget, and active pricing snapshot.
- Member join flow with authenticated room access and selected/watch team preference.
- Reuse the same board, roster/team panels, budget summaries, shortlist/context panels, and export-oriented sale log patterns used by real/mock draft pages.
- Commissioner-only sale logging through fast text commands and board-driven add flows.
- Ordinary authenticated `POST` mutations for sales, undo, correction, room start/end, and export finalization.
- SSE stream for room updates, with polling fallback by room revision.
- Postgres source of truth: append-only event log plus derived room projections for board, teams, budgets, and availability.
- Idempotent mutation handling so double-submit/retry does not duplicate sales.
- Room readiness checks before start: published setup, active model run, complete teams, valid keepers, budget/roster rules, resolved player identities.
- Final export through Epic 10.

## Deferred Scope

- Multi-commissioner simultaneous write workflow.
- Member-entered live mutations or collaborative bidding.
- Full snake draft execution.
- Voice input, OCR, or ESPN writeback.
- Complex bid history/countdown auction mechanics.
- Offline-first local queue with later reconciliation.
- Public spectator rooms outside league membership.
- Per-pick chat, reactions, or presence beyond basic connected/viewing state.
- Advanced commissioner override policy beyond minimal launch exceptions.

## Data Model Impact

- `draft_rooms`: league, league season, room type, status, active model run, active pricing snapshot, started/ended timestamps, creator, current revision.
- `draft_room_participants`: room, user, selected/watch team, connection metadata, timestamps.
- `draft_room_events`: append-only event log with sequence, idempotency key, actor, event type, parsed payload, raw command, validation result, revision, timestamp.
- `draft_room_sales`: committed sale projection with team, player, position, price, expected/live prices, source event, void/corrected references.
- `draft_room_team_states`: spent, budget remaining, roster slots, position counts, max bid, roster validity.
- `draft_room_player_states`: available/sold/keeper/unavailable state per player.
- `draft_room_snapshots`: optional compact projection checkpoint for faster reload/replay.
- `draft_room_exports`: generated export metadata and immutable payload hash.

Events are authoritative. Projections can be rebuilt from the published league-season inputs plus ordered draft room events.

## Realtime And Event Contracts

- `POST /api/draft-rooms`: commissioner creates room from `leagueSeasonId`.
- `POST /api/draft-rooms/:roomId/start`: commissioner starts the room after readiness passes.
- `GET /api/draft-rooms/:roomId`: authenticated member reads current projected room state.
- `GET /api/draft-rooms/:roomId/events?afterRevision=N`: polling fallback for missed updates.
- `GET /api/draft-rooms/:roomId/stream`: authenticated SSE stream.
- `POST /api/draft-rooms/:roomId/sales`: commissioner submits `{ command | structuredSale, idempotencyKey, expectedRevision }`.
- `POST /api/draft-rooms/:roomId/undo`: commissioner appends an undo event for the latest undoable event.
- `POST /api/draft-rooms/:roomId/corrections`: commissioner appends a correction that voids/replaces a prior sale.
- `POST /api/draft-rooms/:roomId/end`: commissioner closes room and freezes final result.
- `POST /api/draft-rooms/:roomId/exports`: commissioner generates final export.

SSE message shape:

```json
{
  "type": "room.snapshot|room.patch|sale.committed|sale.rejected|event.undone|room.status_changed|heartbeat",
  "roomId": "dr_...",
  "revision": 42,
  "sequence": 42,
  "occurredAt": "2026-08-09T00:00:00.000Z",
  "payload": {}
}
```

Contract rules:

- Every committed mutation increments `revision`.
- Clients reconnect with `Last-Event-ID` or `afterRevision`.
- If a client is too stale, the server sends `room.snapshot`.
- POST responses include the same projected state or patch the SSE stream will publish.
- Polling fallback uses revision comparison and returns empty when unchanged.
- Failed validations do not append sale events unless explicitly recorded as non-mutating audit attempts.

## Commissioner Command And Validation UX

Supported launch commands:

- `cam puka 62`
- `Cam took Puka for 62`
- `Tom bought Chase at $62`
- board add flow: selected player + selected team + price

Command handling:

- Resolve team/owner text against fantasy team names, owner display names, and aliases.
- Resolve player text against canonical players, aliases, normalized names, position-aware fuzzy matches, and room availability.
- Return explicit choices for ambiguous matches before committing.
- Dry-run validation runs before append and returns actionable copy tied to the command field.
- Successful command clears input, appends sale, removes player from board, updates rosters/budgets/live values, and broadcasts revision.
- Undo appends a reversible event rather than deleting history.
- Correction appends a replacement event linked to the original sale.
- Commissioner sees latest command, parsed interpretation, warning/blocker status, and one-click undo.

## Roster And Budget Error States

Blocking errors:

- unknown team/owner
- unknown, unavailable, kept, already sold, or ambiguous player
- invalid price, non-integer price, below minimum bid, or negative price
- price exceeds team max bid
- team has no roster slots remaining
- position maximum exceeded
- duplicate sale or stale idempotency replay with different payload
- room not started, ended, locked, or not based on a published season

Warnings:

- sale is far above/below live expected price
- team is nearing positional imbalance
- team has too little budget for remaining required slots
- player identity came from fuzzy/alias match
- model run or projections are stale but still launch-allowed
- commissioner is correcting/undoing an older event with downstream effects

State surfaces:

- Team panels show spent, remaining budget, max bid, roster slots remaining, and position counts.
- Invalid teams receive visible status until corrected.
- Board rows tag sold, kept, roster max for selected team, over max bid, and unavailable.
- Final export is blocked while any team has impossible budget/roster state unless an explicit override policy is approved.

## Privacy And Role Boundaries

- League members can read shared room state for their league only.
- Commissioners/admins can create, start, mutate, undo, correct, end, and export real rooms.
- Members can select their watch team and local UI preferences.
- Members cannot mutate real draft events at launch.
- Observers can read room state if their league role permits.
- Non-members cannot open room state, polling, SSE, or exports.
- Shared room state includes teams, owners, sold players, prices, budgets, live prices, and final results.
- Private strategy artifacts, notes, mocks, shortlists, and max-bid overlays remain user-owned.

## Dependencies

- Epic 1 for authentication, sessions, roles, and SSE authorization.
- Epic 2 for published league season, teams, auction rules, keepers, and draft-room settings.
- Epic 3 for canonical player identity and aliases.
- Epic 4 for active pricing snapshot, live-adjusted pricing, explanations, and readiness warnings.
- Epics 5 and 6 for reusable board/team concepts and event patterns.
- Epic 7 for private strategy overlays and selected/watch team recommendations.
- Epic 10 for Postgres persistence, migrations, observability, background jobs, deployment readiness, and export.

## Acceptance Criteria

- A commissioner can start a real live draft room only from a published league season.
- League members can join the room, select/view teams, refresh, and see the same current state.
- A valid command like `cam puka 62` commits one sale and broadcasts the update.
- Natural-language commands resolve owners, players, and prices consistently.
- Ambiguous or impossible commands return clear errors and do not mutate room state.
- Undo and correction preserve audit history and rebuild projections correctly.
- Board, roster/team panels, budgets, and live price fields update after every sale.
- SSE reconnect and polling fallback both recover missed revisions.
- Duplicate POST retries with the same idempotency key do not duplicate events.
- Members cannot mutate real room state; non-members cannot read it.
- Final export matches the committed event log and projected roster state.

## Test And Verification Strategy

- Unit tests for command parsing, owner/player resolution, validation, undo, correction, and projection replay.
- Property tests for budget invariants: no negative remaining budget, max bid respects remaining slots, sold players cannot reappear.
- API tests for room lifecycle, permissions, idempotency, stale revision handling, and export generation.
- SSE integration tests for initial snapshot, patch delivery, reconnect via last revision, heartbeat, and polling fallback.
- Projection rebuild tests proving event log replay reproduces stored room state.
- Component tests proving board/team panels render sold, kept, budget, roster, and error states.
- End-to-end smoke: commissioner starts room, member joins, sale is logged, member receives update, undo/correction works, export is generated.
- Load smoke for launch league size with several connected clients and rapid command entry.

## Risks And Open Questions

- Decide whether launch permits commissioner overrides for real-world mistakes that violate budget/roster rules.
- Define acceptable SSE latency and reconnect retention window.
- Decide whether projection tables are updated in the mutation transaction or rebuilt asynchronously with checkpoints.
- Confirm how strongly live pricing must update during draft night.
- Define final export format details with Epic 10.
- Decide whether practice rooms share the same event model with `room_type=practice`.
- Clarify co-owner/watch-team behavior.
