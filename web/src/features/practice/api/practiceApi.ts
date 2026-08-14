import { z } from "zod";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import { requestPlatformJson } from "../../../shared/api/http/requestPlatformJson";
import { playerCatalogSchema } from "./playerCatalogSchema";
import {
  practiceShortlistItemSchema,
  practiceShortlistSchema,
} from "./practiceContextSchema";
import { simulationHistoryItemSchema } from "./simulationSchema";

export { loadSimulation, loadSimulationRun, runSimulations } from "./simulationApi";

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
