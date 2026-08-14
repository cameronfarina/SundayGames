import { describe, expect, it } from "vitest";
import { requiredDateFromDb } from "./dates.js";
import { jsonbParameter, jsonValueFromDb } from "./json.js";
import { runFromRow } from "./runCodec.js";
import { strategyFromDb } from "./strategyCodec.js";
import type { SimulationRunRow } from "./types.js";

const minimalRow = (): SimulationRunRow => ({
  id: "sim_1", league_id: "league_1", league_season_id: "season_2026",
  user_id: "user_1", job_id: null, model_run_id: null,
  pricing_snapshot_id: null, strategy_plan_version_id: null,
  owner_id: "owner_1", team_id: "team_1", idempotency_key: "request_1",
  input_hash: "hash_1", request_json: null, status: "requested",
  started_at: null, completed_at: null,
  created_at: "2026-08-09T16:00:00.000Z",
  updated_at: "2026-08-09T16:00:00.000Z", result_id: null,
  summary_json: null, result_set_json: null, result_created_at: null,
});

describe("Postgres simulation defensive codecs", () => {
  it("uses stable request defaults for missing persisted request JSON", () => {
    expect(runFromRow(minimalRow())).toMatchObject({
      request: {
        id: "simreq_sim_1",
        count: 1,
        seedPrefix: "",
        strategy: { hardLocks: [], softTargets: [] },
      },
      startedAt: undefined,
      completedAt: undefined,
      result: undefined,
    });
  });

  it("filters malformed strategy entries without losing valid candidates", () => {
    expect(strategyFromDb({
      hardLocks: [null, { playerName: "Player", price: "5" }],
      softTargets: [{
        label: "targets",
        candidatePool: ["Valid Player", 7],
        maxBid: 20,
      }, { label: "invalid", candidatePool: [], maxBid: "20" }],
    })).toEqual({
      hardLocks: [],
      softTargets: [{
        label: "targets",
        candidatePool: ["Valid Player"],
        maxBid: 20,
      }],
    });
    expect(strategyFromDb({ hardLocks: "invalid", softTargets: "invalid" })).toEqual({
      hardLocks: [],
      softTargets: [],
    });
    expect(strategyFromDb({
      hardLocks: [{ playerName: "Player", price: 5, priceMode: "unknown" }],
    })).toMatchObject({
      hardLocks: [{
        playerName: "Player",
        price: 5,
        priceMode: "exact",
        auctionOwner: undefined,
      }],
    });
  });

  it("rejects invalid dates and values that JSON cannot represent", () => {
    expect(() => requiredDateFromDb("created_at", "not-a-date")).toThrow(
      "Postgres simulation row has invalid created_at.",
    );
    expect(() => jsonValueFromDb({ invalid: 1n })).toThrow();
    expect(jsonValueFromDb("stored-value")).toBe("stored-value");
    expect(() => jsonValueFromDb(() => undefined)).toThrow(
      "Postgres simulation row contains invalid JSON.",
    );
    expect(() => jsonbParameter(undefined)).toThrow(
      "Simulation data cannot be serialized as JSON.",
    );
  });

  it("falls back safely when persisted result details are malformed", () => {
    const malformedResult = runFromRow({
      ...minimalRow(),
      result_set_json: {
        completedAt: "not-a-date",
        forcedSales: [{ invalid: true }],
        summary: { invalid: true },
        seasonSimulation: { invalid: true },
      },
    }).result;
    expect(malformedResult).toMatchObject({
      completedAt: new Date("2026-08-09T16:00:00.000Z"),
      forcedSales: [],
      summary: {
        runCount: 1,
        scenarios: [],
        players: [],
        owners: [],
        ownerPlayerExposure: [],
      },
    });
    expect(malformedResult?.seasonSimulation).toBeUndefined();
    expect(runFromRow({ ...minimalRow(), result_set_json: "invalid" }).result)
      .toBeUndefined();
  });
});
