import { describe, expect, it } from "vitest";
import { resultFromRow } from "./resultCodec.js";
import type { SimulationRunRow } from "./types.js";

const seasonSimulation = {
  draftFormat: "auction",
  runCount: 1,
  completedCount: 1,
  seedPrefix: "season-run",
  strategy: {
    rawInput: "Draft an elite RB",
    targets: [{ playerName: "Jahmyr Gibbs", maxAuctionPrice: 78 }],
    preferredPositions: [{ position: "RB", tier: "elite", targetCount: 1 }],
    positionCaps: [{ position: "WR", maxAuctionPrice: 25, excludeNamedTargets: true }],
    summary: "Target Gibbs and cap other wide receivers.",
    warnings: [],
  },
  targetOutcomes: [{
    playerId: "jahmyr-gibbs",
    playerName: "Jahmyr Gibbs",
    status: "hit",
    feasible: true,
    hitCount: 1,
    hitRate: 1,
    message: "Target acquired.",
  }],
  preferenceOutcomes: [{
    position: "RB",
    tier: "elite",
    targetCount: 1,
    status: "hit",
    feasible: true,
    hitCount: 1,
    hitRate: 1,
    rule: {
      basis: "auction_expected_value",
      positionRankMaximum: 4,
      qualifyingPlayerIds: ["jahmyr-gibbs"],
      minimumExpectedValue: 70,
    },
    message: "Elite RB acquired.",
  }],
  playerExposure: [{
    playerId: "jahmyr-gibbs",
    playerName: "Jahmyr Gibbs",
    position: "RB",
    count: 1,
    rate: 1,
    averagePrice: 78,
  }],
  positionCounts: { RB: { total: 2, perRun: 2 } },
  runs: [{
    runNumber: 1,
    label: "Run 1",
    seed: "season-run-1",
    teams: [{
      teamId: "team_1",
      teamName: "Short King",
      isUserTeam: true,
      roster: [{
        playerId: "jahmyr-gibbs",
        playerName: "Jahmyr Gibbs",
        position: "RB",
        source: "human",
        price: 78,
        rosterSlot: "RB1",
        starter: true,
        week1Points: 20.1,
      }],
      week1Points: 20.1,
      spent: 78,
      budgetRemaining: 122,
    }],
  }],
};

const completedRow = (): SimulationRunRow => ({
  id: "sim_1", league_id: "league_1", league_season_id: "season_2026",
  user_id: "user_1", job_id: null, model_run_id: null,
  pricing_snapshot_id: null, strategy_plan_version_id: null,
  owner_id: "owner_1", team_id: "team_1", idempotency_key: "request_1",
  input_hash: "hash_1", request_json: { id: "simreq_1", count: 1 },
  status: "completed", started_at: null,
  completed_at: "2026-08-09T16:00:02.000Z",
  created_at: "2026-08-09T16:00:00.000Z",
  updated_at: "2026-08-09T16:00:02.000Z", result_id: "result_1",
  summary_json: null,
  result_set_json: {
    completedAt: "2026-08-09T16:00:02.000Z",
    runCount: 1,
    summary: { runCount: 1, scenarios: [], players: [], owners: [], ownerPlayerExposure: [] },
    seasonSimulation,
  },
  result_created_at: "2026-08-09T16:00:02.000Z",
});

describe("Postgres season simulation result codec", () => {
  it("preserves complete season results while restoring the completion date", () => {
    expect(resultFromRow(completedRow())).toMatchObject({
      completedAt: new Date("2026-08-09T16:00:02.000Z"),
      seasonSimulation,
    });
  });
});
