import { z } from "zod";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import { requestPlatformJson } from "../../../shared/api/http/requestPlatformJson";
import { playerCatalogSchema } from "./playerCatalogSchema";
import {
  practiceContextSchema,
  practiceShortlistItemSchema,
  practiceShortlistSchema,
} from "./practiceContextSchema";
import { simulationHistoryItemSchema, simulationResponseSchema } from "./simulationSchema";

interface RequestContext {
  readonly fetcher?: PlatformFetch;
  readonly signal?: AbortSignal;
}

interface SeasonRequest extends RequestContext {
  readonly seasonId: string;
}

const fetcherExtra = (context: RequestContext) => (
  context.fetcher === undefined ? {} : { fetcher: context.fetcher }
);

const getInit = (context: RequestContext): RequestInit => ({
  method: "GET",
  ...(context.signal === undefined ? {} : { signal: context.signal }),
});

const jsonInit = (method: "DELETE" | "POST" | "PUT", body: unknown): RequestInit => ({
  body: JSON.stringify(body),
  headers: { "content-type": "application/json" },
  method,
});

export const getPracticeContext = async (context: RequestContext = {}) =>
  await requestPlatformJson({
    ...fetcherExtra(context),
    init: getInit(context),
    path: "/onboarding",
    responseSchema: practiceContextSchema,
  });

interface CatalogRequest extends RequestContext {
  readonly seasonId?: string;
  readonly strategy: string;
}

export const getPlayerCatalog = async (request: CatalogRequest) => {
  const query = new URLSearchParams();
  if (request.seasonId !== undefined) query.set("seasonId", request.seasonId);
  query.set("strategy", request.strategy);
  return await requestPlatformJson({
    ...fetcherExtra(request),
    init: getInit(request),
    path: `/player-catalog?${query.toString()}`,
    responseSchema: playerCatalogSchema,
  });
};

export const listPracticeShortlist = async (request: SeasonRequest) => {
  const query = new URLSearchParams({ seasonId: request.seasonId });
  const response = await requestPlatformJson({
    ...fetcherExtra(request),
    init: getInit(request),
    path: `/practice-shortlist?${query.toString()}`,
    responseSchema: practiceShortlistSchema,
  });
  return response.items;
};

interface SaveTargetRequest extends SeasonRequest {
  readonly maxBid?: number;
  readonly playerName: string;
  readonly position: string;
}

export const savePracticeTarget = async (request: SaveTargetRequest) => {
  const body = {
    ...(request.maxBid === undefined ? {} : { maxBid: request.maxBid }),
    playerName: request.playerName,
    position: request.position,
    seasonId: request.seasonId,
  };
  const response = await requestPlatformJson({
    ...fetcherExtra(request),
    init: jsonInit("PUT", body),
    path: "/practice-shortlist",
    responseSchema: z.object({ item: practiceShortlistItemSchema }),
  });
  return response.item;
};

interface RemoveTargetRequest extends SeasonRequest {
  readonly playerName: string;
}

export const removePracticeTarget = async (request: RemoveTargetRequest) => {
  const response = await requestPlatformJson({
    ...fetcherExtra(request),
    init: jsonInit("DELETE", { playerName: request.playerName, seasonId: request.seasonId }),
    path: "/practice-shortlist",
    responseSchema: z.object({ removed: z.boolean() }),
  });
  return response.removed;
};

export const listSimulationHistory = async (request: SeasonRequest) => {
  const query = new URLSearchParams({ seasonId: request.seasonId });
  const response = await requestPlatformJson({
    ...fetcherExtra(request),
    init: getInit(request),
    path: `/season-simulations?${query.toString()}`,
    responseSchema: z.object({ history: z.array(simulationHistoryItemSchema) }),
  });
  return response.history;
};

interface LoadSimulationRequest extends RequestContext {
  readonly historyId: string;
}

export const loadSimulation = async (request: LoadSimulationRequest) =>
  await requestPlatformJson({
    ...fetcherExtra(request),
    init: getInit(request),
    path: `/season-simulations/${encodeURIComponent(request.historyId)}`,
    responseSchema: simulationResponseSchema,
  });

interface RunSimulationRequest extends SeasonRequest {
  readonly count: number;
  readonly note: string;
  readonly strategy: string;
  readonly strategyPreset: string;
}

export const runSimulations = async (request: RunSimulationRequest) =>
  await requestPlatformJson({
    ...fetcherExtra(request),
    init: jsonInit("POST", {
      count: request.count,
      note: request.note,
      seasonId: request.seasonId,
      strategy: request.strategy,
      strategyPreset: request.strategyPreset,
    }),
    path: "/season-simulations",
    responseSchema: simulationResponseSchema,
  });
