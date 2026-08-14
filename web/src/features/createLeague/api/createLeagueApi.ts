import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import { requestPlatformJson } from "../../../shared/api/http/requestPlatformJson";
import type { ConfirmedLeagueSetup } from "../model/createLeagueTypes";
import { createLeagueResponseSchema, espnReviewOutcomeSchema } from "./createLeagueSchemas";

export interface EspnReviewInput {
  readonly leagueIdOrUrl: string;
  readonly season: number;
}

export const reviewEspnLeague = (
  input: EspnReviewInput,
  fetcher: PlatformFetch = fetch,
) => requestPlatformJson({
  path: "/league-imports/espn/review",
  responseSchema: espnReviewOutcomeSchema,
  fetcher,
  init: {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  },
});

export const createLeague = (
  setup: ConfirmedLeagueSetup,
  fetcher: PlatformFetch = fetch,
) => requestPlatformJson({
  path: "/leagues",
  responseSchema: createLeagueResponseSchema,
  fetcher,
  init: {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ setup }),
  },
});
