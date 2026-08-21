import { requestPlatformJson, type PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import {
  simulationRunResponseSchema,
  simulationOutcomeResponseSchema,
  simulationLaunchSchema,
  simulationResponseSchema,
  type SimulationProgress,
} from "./simulationSchema";
import {
  runSimulationInBrowser,
  type BrowserSimulationWorkerFactory,
} from "./browserSimulationRunner";

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
  readonly seasonId: string;
  readonly strategy: string;
  readonly strategyPreset: string;
  readonly workerFactory?: BrowserSimulationWorkerFactory | undefined;
}

export const runSimulations = async (request: RunSimulationRequest) => {
  if (request.signal?.aborted === true) throw new DOMException("Simulation canceled.", "AbortError");
  const fetcher = request.fetcher ?? fetch;
  const controller = new AbortController();
  const abort = (): void => { controller.abort(); };
  request.signal?.addEventListener("abort", abort, { once: true });
  globalThis.addEventListener("pagehide", abort, { once: true });
  let historyId: string | undefined;
  const requestId = globalThis.crypto.randomUUID();
  try {
    const launch = await requestPlatformJson({
      fetcher,
      init: {
        body: JSON.stringify({
          count: request.count,
          note: request.note,
          requestId,
          seasonId: request.seasonId,
          strategy: request.strategy,
          strategyPreset: request.strategyPreset,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
        signal: controller.signal,
      },
      path: "/season-simulations",
      responseSchema: simulationLaunchSchema,
    });
    historyId = launch.historyId;
    const simulation = await runSimulationInBrowser(launch.input, {
      onProgress: request.onProgress,
      signal: controller.signal,
      ...(request.workerFactory === undefined ? {} : { workerFactory: request.workerFactory }),
    });
    const completionRequest = async () => await requestPlatformJson({
      fetcher,
      init: {
        body: JSON.stringify({
          simulation,
          note: launch.note,
          inputDigest: launch.inputDigest,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
        signal: controller.signal,
      },
      path: `/season-simulations/${encodeURIComponent(launch.historyId)}/complete`,
      responseSchema: simulationResponseSchema,
    });
    try {
      return await completionRequest();
    } catch (error) {
      const deterministicFailure = error instanceof PlatformApiError && error.status >= 400 && error.status < 500;
      if (controller.signal.aborted || deterministicFailure) throw error;
      return await completionRequest();
    }
  } catch (error) {
    const cancellationPath = historyId === undefined
      ? `/season-simulations/requests/${encodeURIComponent(requestId)}?seasonId=${encodeURIComponent(request.seasonId)}`
      : `/season-simulations/${encodeURIComponent(historyId)}`;
    void fetcher(cancellationPath, {
      credentials: "same-origin",
      keepalive: true,
      method: "DELETE",
    }).catch(() => undefined);
    throw error;
  } finally {
    request.signal?.removeEventListener("abort", abort);
    globalThis.removeEventListener("pagehide", abort);
  }
};
