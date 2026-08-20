import { describe, expect, it } from "vitest";
import { summarizeLoadMeasurements } from "../scripts/platformLoadTest/metrics.js";

describe("platform load-test metrics", () => {
  it("reports latency percentiles and the failed-attempt rate", () => {
    expect(summarizeLoadMeasurements([
      { diagnostic: "ok", durationMs: 40, ok: true, status: 200 },
      { diagnostic: "ok", durationMs: 10, ok: true, status: 200 },
      { diagnostic: "http_503", durationMs: 30, ok: false, status: 503 },
      { diagnostic: "invalid_json", durationMs: 20, ok: false, status: 200 },
    ])).toEqual({
      attempts: 4,
      diagnostics: { http_503: 1, invalid_json: 1, ok: 2 },
      errorRate: 0.5,
      maximumMs: 40,
      p50Ms: 20,
      p95Ms: 40,
      statuses: { "200": 3, "503": 1 },
    });
  });
});
