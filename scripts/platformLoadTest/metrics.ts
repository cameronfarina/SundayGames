export interface LoadMeasurement {
  readonly diagnostic: string;
  readonly durationMs: number;
  readonly ok: boolean;
  readonly status?: number | undefined;
}

export interface LoadMetricSummary {
  readonly attempts: number;
  readonly diagnostics: Readonly<Record<string, number>>;
  readonly errorRate: number;
  readonly maximumMs: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly statuses: Readonly<Record<string, number>>;
}

export const elapsedMeasurement = (
  diagnostic: string,
  startedAt: number,
  status?: number,
): LoadMeasurement => ({
  diagnostic,
  durationMs: performance.now() - startedAt,
  ok: diagnostic === "ok",
  ...(status === undefined ? {} : { status }),
});

const countsFor = (values: readonly string[]): Readonly<Record<string, number>> => {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
};

export const summarizeLoadMeasurements = (
  measurements: readonly LoadMeasurement[],
): LoadMetricSummary => {
  if (measurements.length === 0) {
    throw new Error("Cannot summarize an empty load measurement set.");
  }
  const durations = measurements.map(measurement => measurement.durationMs)
    .sort((left, right) => left - right);
  const percentile = (percentage: number): number =>
    durations[Math.ceil(durations.length * percentage) - 1] ?? durations[0] ?? 0;
  return {
    attempts: measurements.length,
    diagnostics: countsFor(measurements.map(measurement => measurement.diagnostic)),
    errorRate: measurements.filter(measurement => !measurement.ok).length / measurements.length,
    maximumMs: durations.at(-1) ?? 0,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    statuses: countsFor(measurements.flatMap(measurement =>
      measurement.status === undefined ? [] : [String(measurement.status)])),
  };
};
