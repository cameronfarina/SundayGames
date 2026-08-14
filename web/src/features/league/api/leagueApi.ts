import { requestPlatformJson } from "../../../shared/api/http/requestPlatformJson";
import {
  leagueSeasonResponseSchema,
  seasonKeepersResponseSchema,
  teamClaimResponseSchema,
} from "./leagueSchemas";

export const loadLeagueSeason = (seasonId: string, fetcher: typeof fetch = fetch) =>
  requestPlatformJson({
    path: `/seasons/${encodeURIComponent(seasonId)}`,
    responseSchema: leagueSeasonResponseSchema,
    fetcher,
  });

export const loadSeasonKeepers = (seasonId: string, fetcher: typeof fetch = fetch) =>
  requestPlatformJson({
    path: `/seasons/${encodeURIComponent(seasonId)}/keepers`,
    responseSchema: seasonKeepersResponseSchema,
    fetcher,
  });

export interface ClaimLeagueTeamInput {
  readonly seasonId: string;
  readonly ownerId: string;
  readonly teamId: string;
}

export const claimLeagueTeam = (input: ClaimLeagueTeamInput, fetcher: typeof fetch = fetch) =>
  requestPlatformJson({
    path: `/seasons/${encodeURIComponent(input.seasonId)}/team-claims`,
    responseSchema: teamClaimResponseSchema,
    fetcher,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ownerId: input.ownerId, teamId: input.teamId }),
    },
  });
