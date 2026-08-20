import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import { requestPlatformJson } from "../../../shared/api/http/requestPlatformJson";
import {
  simulationRunResponseSchema,
  simulationOutcomeResponseSchema,
  simulationResponseSchema,
  type SimulationProgress,
} from "./simulationSchema";
import { consumeSimulationStream } from "./simulationEventStream";

interface RequestContext {
  readonly fetcher?: PlatformFetch;
  readonly signal?: AbortSignal;
}

interface LoadSimulationRequest extends RequestContext {
  readonly historyId: string;
}

const fetcherExtra = (context: RequestContext) => (
  context.fetcher === undefined ? {} : { fetcher: context.fetcher }
);

const getInit = (signal: AbortSignal | undefined): RequestInit => ({
  method: "GET",
  ...(signal === undefined ? {} : { signal }),
});

export const loadSimulation = async (request: LoadSimulationRequest) =>
  await requestPlatformJson({
    ...fetcherExtra(request),
    init: getInit(request.signal),
    path: `/season-simulations/${encodeURIComponent(request.historyId)}`,
    responseSchema: simulationResponseSchema,
  });

interface LoadSimulationRunRequest extends LoadSimulationRequest {
  readonly runNumber: number;
}

export const loadSimulationRun = async (request: LoadSimulationRunRequest) =>
  await requestPlatformJson({
    ...fetcherExtra(request),
    init: getInit(request.signal),
    path: `/season-simulations/${encodeURIComponent(request.historyId)}/runs/${String(request.runNumber)}`,
    responseSchema: simulationRunResponseSchema,
  });

interface FavoriteSimulationOutcomeRequest extends LoadSimulationRunRequest {
  readonly favorite: boolean;
}

export const setSimulationOutcomeFavorite = async (
  request: FavoriteSimulationOutcomeRequest,
) => await requestPlatformJson({
  ...fetcherExtra(request),
  init: {
    body: JSON.stringify({ favorite: request.favorite }),
    headers: { "content-type": "application/json" },
    method: "PATCH",
  },
  path: `/season-simulations/${encodeURIComponent(request.historyId)}/runs/${String(request.runNumber)}`,
  responseSchema: simulationOutcomeResponseSchema,
});

interface RunSimulationRequest extends RequestContext {
  readonly count: number;
  readonly note: string;
  readonly onProgress: (progress: SimulationProgress) => void;
  readonly requestId?: string | undefined;
  readonly seasonId: string;
  readonly strategy: string;
  readonly strategyPreset: string;
}

export const runSimulations = async (request: RunSimulationRequest) => {
  const fetcher = request.fetcher ?? fetch;
  const requestId = request.requestId ?? crypto.randomUUID();
  const response = await fetcher("/season-simulations", {
    body: JSON.stringify({
      count: request.count,
      note: request.note,
      requestId,
      seasonId: request.seasonId,
      strategy: request.strategy,
      strategyPreset: request.strategyPreset,
    }),
    credentials: "same-origin",
    headers: { Accept: "text/event-stream", "content-type": "application/json" },
    method: "POST",
    ...(request.signal === undefined ? {} : { signal: request.signal }),
  });
  if (!response.ok) {
    await requestPlatformJson({
      fetcher: () => Promise.resolve(response),
      path: "/season-simulations",
      responseSchema: simulationResponseSchema,
    });
  }
  return await consumeSimulationStream(response, {
    onProgress: request.onProgress,
    reconnect: async handle => await fetcher(
      `/season-simulations/${encodeURIComponent(handle.historyId)}/observe?jobId=${encodeURIComponent(handle.jobId)}`,
      {
        credentials: "same-origin",
        headers: { Accept: "text/event-stream" },
        method: "GET",
        ...(request.signal === undefined ? {} : { signal: request.signal }),
      },
    ),
  });
};
