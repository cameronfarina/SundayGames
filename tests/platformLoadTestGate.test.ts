import { describe, expect, it } from "vitest";
import { evaluateLoadMetric } from "../scripts/platformLoadTest/gate.js";

const summary = {
  attempts: 600,
  diagnostics: { http_503: 12, ok: 588 },
  errorRate: 0.02,
  maximumMs: 2_100,
  p50Ms: 120,
  p95Ms: 850,
  statuses: { "200": 588, "503": 12 },
};

describe("platform load-test gates", () => {
  it("passes when latency and errors stay inside the configured budget", () => {
    expect(evaluateLoadMetric("draft streams", summary, {
      maximumErrorRate: 0.02,
      maximumP95Ms: 1_000,
    })).toEqual({ failures: [], passed: true });
  });

  it("reports every exceeded budget", () => {
    expect(evaluateLoadMetric("draft streams", summary, {
      maximumErrorRate: 0.01,
      maximumP95Ms: 500,
    })).toEqual({
      failures: [
        "draft streams error rate 2.00% exceeded 1.00%.",
        "draft streams p95 850ms exceeded 500ms.",
      ],
      passed: false,
    });
  });
});
