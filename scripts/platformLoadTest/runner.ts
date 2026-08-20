import { runDraftMutationLoad, type DraftMutationLoadResult } from "./draftMutations.js";
import type { PlatformLoadManifest } from "./manifest.js";
import { openDraftStreamBatch } from "./draftStreams.js";
import { evaluateLoadMetric } from "./gate.js";
import { runAuthenticatedHttpBurst, type AuthenticatedLoadResult } from "./httpBurst.js";
import { waitForQueuedLoadJobs } from "./jobCompletion.js";
import { platformLoadRequestsFromManifest } from "./manifest.js";
import { summarizeLoadMeasurements, type LoadMeasurement, type LoadMetricSummary } from "./metrics.js";
import { platformLoadScenarioForLeagueCount, type PlatformLoadScenario } from "./scenario.js";

export interface RunPlatformLoadTestInput {
  readonly baseUrl: URL;
  readonly eventTimeoutMs?: number | undefined;
  readonly holdMs: number;
  readonly jobPollIntervalMs?: number | undefined;
  readonly jobTimeoutMs?: number | undefined;
  readonly leagueCount: number;
  readonly manifest: PlatformLoadManifest;
  readonly mutationPaceMs?: number | undefined;
}

export interface PlatformLoadTestReport {
  readonly failures: readonly string[];
  readonly metadata: {
    readonly finishedAt: string;
    readonly holdMs: number;
    readonly queuedSimulationJobs: number;
    readonly scenario: PlatformLoadScenario;
    readonly startedAt: string;
    readonly targetOrigin: string;
  };
  readonly passed: boolean;
  readonly summaries: {
    readonly draftFanout: LoadMetricSummary;
    readonly draftMutations: LoadMetricSummary;
    readonly draftReconnects: LoadMetricSummary;
    readonly draftStreams: LoadMetricSummary;
    readonly news: LoadMetricSummary;
    readonly simulationCompletions: LoadMetricSummary | null;
    readonly simulationSubmissions: LoadMetricSummary;
  };
}

const waitForHold = async (startedAt: number, holdMs: number): Promise<void> => {
  const remaining = holdMs - (performance.now() - startedAt);
  if (remaining > 0) await new Promise<void>(resolve => setTimeout(resolve, remaining));
};

const gateFor = (
  label: string,
  summary: LoadMetricSummary,
  maximumP95Ms: number,
): readonly string[] => evaluateLoadMetric(label, summary, {
  maximumErrorRate: 0,
  maximumP95Ms,
}).failures;

export const runPlatformLoadTest = async (
  input: RunPlatformLoadTestInput,
): Promise<PlatformLoadTestReport> => {
  if (!Number.isFinite(input.holdMs) || input.holdMs < 0) {
    throw new Error("Load-test hold duration must be zero or greater.");
  }
  const startedAt = new Date();
  const scenario = platformLoadScenarioForLeagueCount(input.leagueCount);
  const requests = platformLoadRequestsFromManifest(scenario, input.manifest);
  const draftBatch = await openDraftStreamBatch({ baseUrl: input.baseUrl, clients: requests.draftClients });
  let draftLoad: DraftMutationLoadResult;
  let newsMeasurements: readonly AuthenticatedLoadResult[];
  let simulationMeasurements: readonly AuthenticatedLoadResult[];
  let completionMeasurements: readonly LoadMeasurement[] = [];
  const holdStartedAt = performance.now();
  try {
    [newsMeasurements, simulationMeasurements, draftLoad] = await Promise.all([
      runAuthenticatedHttpBurst(input.baseUrl, requests.newsRequests),
      runAuthenticatedHttpBurst(input.baseUrl, requests.simulationRequests),
      runDraftMutationLoad({
        baseUrl: input.baseUrl,
        clientsPerRoom: scenario.draftClientsPerLeague,
        eventTimeoutMs: input.eventTimeoutMs ?? 5_000,
        mutations: requests.draftMutations,
        paceMs: input.mutationPaceMs ?? 25,
        streams: draftBatch,
      }),
    ]);
    const queuedJobs = simulationMeasurements.flatMap(result =>
      result.queuedJob === undefined ? [] : [result.queuedJob]);
    if (queuedJobs.length > 0) {
      completionMeasurements = await waitForQueuedLoadJobs(input.baseUrl, queuedJobs, {
        pollIntervalMs: input.jobPollIntervalMs,
        timeoutMs: input.jobTimeoutMs,
      });
    }
    await waitForHold(holdStartedAt, input.holdMs);
  } finally {
    await draftBatch.close();
  }
  const summaries = {
    draftFanout: summarizeLoadMeasurements(draftLoad.fanoutMeasurements),
    draftMutations: summarizeLoadMeasurements(draftLoad.mutationMeasurements),
    draftReconnects: summarizeLoadMeasurements(draftLoad.reconnectMeasurements),
    draftStreams: summarizeLoadMeasurements(draftBatch.measurements),
    news: summarizeLoadMeasurements(newsMeasurements),
    simulationCompletions: completionMeasurements.length === 0
      ? null : summarizeLoadMeasurements(completionMeasurements),
    simulationSubmissions: summarizeLoadMeasurements(simulationMeasurements),
  };
  const failures = [
    ...gateFor("Draft streams", summaries.draftStreams, 5_000),
    ...gateFor("Draft reconnects", summaries.draftReconnects, 5_000),
    ...gateFor("Draft mutations", summaries.draftMutations, 3_000),
    ...gateFor("Draft fanout", summaries.draftFanout, 5_000),
    ...evaluateLoadMetric("Player news", summaries.news, {
      maximumErrorRate: 0.01,
      maximumP95Ms: 2_000,
    }).failures,
    ...gateFor("Simulation submissions", summaries.simulationSubmissions, 3_000),
    ...(summaries.simulationCompletions === null
      ? [] : gateFor("Simulation completions", summaries.simulationCompletions, input.jobTimeoutMs ?? 180_000)),
  ];
  for (const [diagnostic, count] of Object.entries(draftBatch.runtimeDiagnostics())) {
    failures.push(`${String(count)} draft streams reported ${diagnostic}.`);
  }
  return {
    failures,
    metadata: {
      finishedAt: new Date().toISOString(),
      holdMs: input.holdMs,
      queuedSimulationJobs: completionMeasurements.length,
      scenario,
      startedAt: startedAt.toISOString(),
      targetOrigin: input.baseUrl.origin,
    },
    passed: failures.length === 0,
    summaries,
  };
};
