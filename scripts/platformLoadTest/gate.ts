import type { LoadMetricSummary } from "./metrics.js";

export interface LoadMetricThresholds {
  readonly maximumErrorRate: number;
  readonly maximumP95Ms: number;
}

export interface LoadGateResult {
  readonly failures: readonly string[];
  readonly passed: boolean;
}

export const evaluateLoadMetric = (
  label: string,
  summary: LoadMetricSummary,
  thresholds: LoadMetricThresholds,
): LoadGateResult => {
  const failures: string[] = [];
  if (summary.errorRate > thresholds.maximumErrorRate) {
    failures.push(
      `${label} error rate ${(summary.errorRate * 100).toFixed(2)}% exceeded `
      + `${(thresholds.maximumErrorRate * 100).toFixed(2)}%.`,
    );
  }
  if (summary.p95Ms > thresholds.maximumP95Ms) {
    failures.push(
      `${label} p95 ${String(summary.p95Ms)}ms exceeded ${String(thresholds.maximumP95Ms)}ms.`,
    );
  }
  return { failures, passed: failures.length === 0 };
};
