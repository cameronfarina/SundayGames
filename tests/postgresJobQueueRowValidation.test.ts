import { describe, expect, it } from "vitest";
import {
  jobFromRow,
  type JobRow,
} from "../src/platform/postgresJobQueue/jobRow.js";

const validRow = (): JobRow => ({
  id: "job_1",
  user_id: "user_cam",
  league_id: "league_home",
  league_season_id: "season_2026",
  kind: "simulation",
  status: "queued",
  idempotency_key: "simulation-1",
  input_hash: "input-hash",
  input_json: { iterations: 25 },
  progress_json: { completed: 0, total: 25, message: "Queued" },
  result_summary_json: null,
  attempt_count: 0,
  max_attempts: 3,
  locked_by: null,
  locked_at: null,
  heartbeat_at: null,
  lock_expires_at: null,
  started_at: null,
  finished_at: null,
  cancellation_requested_at: null,
  sanitized_error_json: null,
  created_at: new Date("2026-08-09T12:00:00.000Z"),
  updated_at: new Date("2026-08-09T12:00:00.000Z"),
});

describe("Postgres job row validation", () => {
  it("maps supported job rows without losing JSON values", () => {
    expect(jobFromRow(validRow())).toMatchObject({
      kind: "simulation",
      status: "queued",
      inputJson: { iterations: 25 },
      progress: { completed: 0, total: 25, message: "Queued" },
    });
  });

  it("rejects unsupported persisted job kinds and statuses", () => {
    expect(() => jobFromRow({ ...validRow(), kind: "billing" })).toThrow(
      "Postgres jobs row has invalid kind.",
    );
    expect(() => jobFromRow({ ...validRow(), status: "paused" })).toThrow(
      "Postgres jobs row has invalid status.",
    );
  });

  it("rejects persisted values that cannot be represented as JSON", () => {
    expect(() => jobFromRow({
      ...validRow(),
      input_json: { unsafe: 1n },
    })).toThrow("Postgres jobs row has invalid input_json.");
  });
});
