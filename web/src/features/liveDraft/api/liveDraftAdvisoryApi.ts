import {
  requestPlatformJson,
  type PlatformFetch,
} from "../../../shared/api/http/requestPlatformJson";
import { liveDraftAdvisorySchema, type LiveDraftAdvisory } from "./liveDraftAdvisorySchemas";

interface LiveDraftAdvisoryRequestOptions {
  readonly fetcher?: PlatformFetch;
  readonly signal?: AbortSignal;
}

export const getLiveDraftAdvisory = async (
  roomId: string,
  options: LiveDraftAdvisoryRequestOptions = {},
): Promise<LiveDraftAdvisory> => await requestPlatformJson({
  path: `/live-rooms/${encodeURIComponent(roomId)}/advisory`,
  responseSchema: liveDraftAdvisorySchema,
  ...(options.fetcher === undefined ? {} : { fetcher: options.fetcher }),
  ...(options.signal === undefined ? {} : { init: { signal: options.signal } }),
});
