import {
  requestPlatformJson,
  type PlatformFetch,
} from "../../../shared/api/http/requestPlatformJson";
import { playerNewsFeedSchema } from "./playerNewsSchema";

interface PlayerNewsRequest {
  readonly fetcher?: PlatformFetch;
  readonly seasonId?: string;
  readonly signal: AbortSignal;
}

export const getPlayerNews = async (request: PlayerNewsRequest) => {
  const query = new URLSearchParams();
  if (request.seasonId !== undefined) query.set("seasonId", request.seasonId);
  const search = query.toString();
  return await requestPlatformJson({
    ...(request.fetcher === undefined ? {} : { fetcher: request.fetcher }),
    init: { signal: request.signal },
    path: search === "" ? "/api/player-news" : `/api/player-news?${search}`,
    responseSchema: playerNewsFeedSchema,
  });
};
