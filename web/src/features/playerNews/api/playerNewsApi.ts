import {
  requestPlatformJson,
  type PlatformFetch,
} from "../../../shared/api/http/requestPlatformJson";
import { playerNewsFeedSchema, type PlayerNewsSource } from "./playerNewsSchema";

interface PlayerNewsRequest {
  readonly fetcher?: PlatformFetch;
  readonly seasonId?: string;
  readonly signal: AbortSignal;
  readonly source: PlayerNewsSource;
}

export const getPlayerNews = async (request: PlayerNewsRequest) => {
  const query = new URLSearchParams();
  if (request.seasonId !== undefined) query.set("seasonId", request.seasonId);
  query.set("source", request.source);
  return await requestPlatformJson({
    ...(request.fetcher === undefined ? {} : { fetcher: request.fetcher }),
    init: { signal: request.signal },
    path: `/api/player-news?${query.toString()}`,
    responseSchema: playerNewsFeedSchema,
  });
};
