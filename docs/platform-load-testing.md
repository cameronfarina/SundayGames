# Platform load testing

Use this harness to exercise the mixed workload expected during draft night. A scenario keeps 12 authenticated event streams open per league while it reconnects one client per room, applies one paced mutation per room, verifies that all 12 clients receive the exact resulting event and revision, performs 1,000 player-news reads, and submits 25 season simulations.

The harness changes draft rooms. Use disposable test accounts and rooms whose current state matches the manifest mutations. Never point it at ordinary production leagues. A remote run requires an approved maintenance window and the explicit `--allow-remote` flag.

## Current scaling dependency

The 30- and 50-league scenarios require 360 and 600 simultaneous draft streams. The current server admits at most 200 streams globally, so these scenarios are expected to fail at stream admission until the v24 configurable-cap work is integrated. Do not report either scenario as green by reducing the client count or ignoring 429 responses.

A local or CI run with Postgres proves functional concurrency only. It does not prove Render Starter capacity. Capacity claims require the unchanged 30- and 50-league scenarios against a controlled Render Starter target with representative networking and service configuration.

## Protect the manifest

The manifest contains live session tokens. Create it outside the repository, restrict it to the current user, and remove it immediately after the run:

```sh
LOAD_MANIFEST_PATH="$(mktemp -t sunday-games-platform-load-manifest)"
chmod 600 "$LOAD_MANIFEST_PATH"
```

Write the JSON to the printed path without changing its mode. The CLI resolves symlinks and refuses manifests inside the repository or with permissions other than `0600`. The repository ignore rule is defense in depth, not permission to store tokens in the worktree.

After the run, delete the manifest and revoke or rotate every test session it contained:

```sh
rm "$LOAD_MANIFEST_PATH"
unset LOAD_MANIFEST_PATH
```

## Manifest contract

Provide exactly 30 or 50 distinct rooms. Each room needs exactly 12 distinct, authorized session tokens and one mutation. The mutation token must be one of that room's connected tokens. Distribute connections across accounts so the server's per-account stream limit is not exceeded.

The mutation must be valid for the room's state and must carry a unique idempotency key and the room's current revision. This example pauses an active disposable room:

```json
{
  "drafts": [
    {
      "roomId": "load-room-01",
      "sessionTokens": [
        "twelve distinct authorized session tokens"
      ],
      "mutation": {
        "action": "pause",
        "sessionToken": "one token from sessionTokens",
        "body": {
          "expectedRevision": 4,
          "idempotencyKey": "load-room-01-pause-run-20260821T120000Z"
        }
      }
    }
  ],
  "newsSessionTokens": [
    "one or more authorized test-account sessions"
  ],
  "simulationRequests": [
    {
      "sessionToken": "simulation-account-a-session",
      "body": { "seasonId": "season-a", "count": 1, "strategy": "balanced" }
    },
    {
      "sessionToken": "simulation-account-b-session",
      "body": { "seasonId": "season-b", "count": 1, "strategy": "balanced" }
    },
    {
      "sessionToken": "simulation-account-c-session",
      "body": { "seasonId": "season-c", "count": 1, "strategy": "balanced" }
    }
  ]
}
```

The harness requires at least three distinct simulation session tokens so 25 submissions are not forced through one user's admission limit. Inputs repeat round-robin to reach the scenario totals. Supported mutation actions are `start`, `pause`, `resume`, `reopen`, `sales`, `undo`, `corrections`, and `end`; their bodies must match the public live-room API contract.

## Run the gates

Run the 30-league scenario first, then repeat unchanged with 50 leagues:

```sh
npm run platform:load -- \
  --target=http://127.0.0.1:10000 \
  --manifest="$LOAD_MANIFEST_PATH" \
  --leagues=30 \
  --hold-seconds=30
```

Use `--allow-remote` only for the controlled Render target. The command refuses other non-loopback targets.

The JSON report contains sanitized target origin, scenario settings, start and finish timestamps, hold duration, diagnostic and HTTP-status buckets, and metric summaries. It never contains session tokens or request bodies.

A pass requires:

- every initial and reconnected draft stream to satisfy the exact SSE contract;
- every room mutation to return the expected JSON contract;
- all 12 current clients in every room to observe the exact event name and new revision within five seconds;
- no unexpected stream close or malformed SSE event;
- no simulation submission error and no more than 1% player-news errors;
- p95 latency below five seconds for stream connections and fanout, two seconds for news, and three seconds for mutations and simulation submission; and
- for queued simulation responses, every returned job ID to reach `completed` before the terminal timeout. `failed`, `canceled`, invalid responses, and timeouts fail the run.

On the current synchronous simulation route, a strict `200` result completes the submission and the completion summary is `null`. After worker isolation integrates the queued `202` response, the same harness polls `/jobs/:id` until the queue has drained to terminal completion.

## CI and capacity follow-up

The existing `production-container` CI job has real Postgres but seeds only one local E2E room and two accounts. After v24 makes the stream cap configurable, add a dedicated disposable-data seed for 30/50 rooms and enough accounts, then run this harness against the production container. Keep that job labeled **functional concurrency**: shared GitHub runners cannot establish Render Starter capacity.

Run the actual capacity gate separately against an approved, controlled Render Starter deployment. Preserve all stream, reconnect, mutation, fanout, and queued-job terminal gates when moving the scenario between CI and Render.
