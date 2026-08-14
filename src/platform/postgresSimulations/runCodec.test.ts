import { describe, expect, it } from "vitest";
import { runFromRow } from "./runCodec.js";
import type { SimulationRunRow } from "./types.js";

const row = (): SimulationRunRow => ({
  id: "sim_1",
  league_id: "league_1",
  league_season_id: "season_2026",
  user_id: "user_1",
  job_id: null,
  model_run_id: null,
  pricing_snapshot_id: null,
  strategy_plan_version_id: null,
  owner_id: "owner_1",
  team_id: "team_1",
  idempotency_key: "request_1",
  input_hash: "hash_1",
  request_json: {
    id: "simreq_1",
    count: 25,
    seedPrefix: "balanced",
    strategy: {
      hardLocks: [{
        playerName: "Jadarian Price",
        price: 15,
        priceMode: "ceiling",
        auctionOwner: "Owner11",
      }],
      softTargets: [{
        label: "wide-receiver",
        candidatePool: ["Ladd McConkey"],
        maxBid: 25,
      }],
    },
  },
  status: "completed",
  started_at: "2026-08-09T16:00:01.000Z",
  completed_at: "2026-08-09T16:00:02.000Z",
  created_at: "2026-08-09T16:00:00.000Z",
  updated_at: "2026-08-09T16:00:02.000Z",
  result_id: "simresult_1",
  summary_json: { runCount: 25 },
  result_set_json: {
    runId: "sim_1",
    requestId: "simreq_1",
    completedAt: "2026-08-09T16:00:02.000Z",
    runCount: 25,
    seedPrefix: "balanced",
    hardLockCount: 1,
    softTargetCount: 1,
    forcedSales: [{ owner: "Owner11", player: "Jadarian Price", price: 15 }],
    summary: {
      runCount: 25,
      scenarios: [],
      players: [],
      owners: [],
      ownerPlayerExposure: [],
    },
    strategyText: "Target Jadarian Price up to $15.",
    note: "Balanced build",
  },
  result_created_at: "2026-08-09T16:00:02.000Z",
});

describe("Postgres simulation run codec", () => {
  it("maps persisted requests and results without losing simulation metadata", () => {
    expect(runFromRow(row())).toEqual({
      id: "sim_1",
      request: {
        id: "simreq_1",
        userId: "user_1",
        leagueId: "league_1",
        seasonId: "season_2026",
        ownerId: "owner_1",
        teamId: "team_1",
        count: 25,
        seedPrefix: "balanced",
        idempotencyKey: "request_1",
        strategy: {
          hardLocks: [{
            playerName: "Jadarian Price",
            price: 15,
            priceMode: "ceiling",
            auctionOwner: "Owner11",
          }],
          softTargets: [{
            label: "wide-receiver",
            candidatePool: ["Ladd McConkey"],
            maxBid: 25,
          }],
        },
        privacyOwnerUserId: "user_1",
        inputHash: "hash_1",
        createdAt: new Date("2026-08-09T16:00:00.000Z"),
      },
      status: "completed",
      privacyOwnerUserId: "user_1",
      createdAt: new Date("2026-08-09T16:00:00.000Z"),
      startedAt: new Date("2026-08-09T16:00:01.000Z"),
      completedAt: new Date("2026-08-09T16:00:02.000Z"),
      result: {
        runId: "sim_1",
        requestId: "simreq_1",
        completedAt: new Date("2026-08-09T16:00:02.000Z"),
        runCount: 25,
        seedPrefix: "balanced",
        hardLockCount: 1,
        softTargetCount: 1,
        forcedSales: [{ owner: "Owner11", player: "Jadarian Price", price: 15 }],
        summary: {
          runCount: 25,
          scenarios: [],
          players: [],
          owners: [],
          ownerPlayerExposure: [],
        },
        strategyText: "Target Jadarian Price up to $15.",
        note: "Balanced build",
      },
    });
  });

  it("rejects an impossible persisted run status", () => {
    expect(() => runFromRow({ ...row(), status: "paused" })).toThrow(
      "Postgres simulation row has invalid status.",
    );
  });
});
