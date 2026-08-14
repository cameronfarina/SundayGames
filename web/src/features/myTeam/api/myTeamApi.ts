import { requestPlatformJson } from "../../../shared/api/http/requestPlatformJson";
import { onboardingSchema } from "./onboardingSchema";
import { postDraftSchema } from "./postDraftSchema";
import { keepersSchema, seasonTeamSchema } from "./seasonTeamSchema";

interface MyTeamRequest {
  readonly signal: AbortSignal;
}

const initFor = (signal: AbortSignal): RequestInit => ({ signal });

export const getOnboarding = async (request: MyTeamRequest) =>
  await requestPlatformJson({
    path: "/onboarding",
    responseSchema: onboardingSchema,
    init: initFor(request.signal),
  });

export const getSeasonTeam = async (seasonId: string, request: MyTeamRequest) =>
  await requestPlatformJson({
    path: `/seasons/${encodeURIComponent(seasonId)}`,
    responseSchema: seasonTeamSchema,
    init: initFor(request.signal),
  });

export const getKeepers = async (seasonId: string, request: MyTeamRequest) =>
  await requestPlatformJson({
    path: `/seasons/${encodeURIComponent(seasonId)}/keepers`,
    responseSchema: keepersSchema,
    init: initFor(request.signal),
  });

export const getPostDraftTeam = async (roomId: string, request: MyTeamRequest) =>
  await requestPlatformJson({
    path: `/live-rooms/${encodeURIComponent(roomId)}/my-team`,
    responseSchema: postDraftSchema,
    init: initFor(request.signal),
  });
