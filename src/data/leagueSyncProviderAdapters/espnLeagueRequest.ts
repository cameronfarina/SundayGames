import {
  LeagueSyncError,
  type DiscoveredLeague,
  type LeagueSyncCredentials,
  type LeagueSyncRequestOptions,
} from "./contracts.js";
import { numberValue, optionalText, recordArray, recordValue } from "./decode.js";
import { fetchLeagueSyncJson } from "./httpJson.js";

export const espnApiOrigin = "https://lm-api-reads.fantasy.espn.com";
export const espnProviderLabel = "ESPN";

const leagueViews: readonly string[] = ["mSettings", "mTeam", "mRoster", "mMatchup"];

export const espnLeagueUrl = (providerLeagueId: string, season: string): string => {
  const path = `/apis/v3/games/ffl/seasons/${encodeURIComponent(season)}` +
    `/segments/0/leagues/${encodeURIComponent(providerLeagueId)}`;
  const url = new URL(path, espnApiOrigin);
  for (const view of leagueViews) url.searchParams.append("view", view);
  return url.toString();
};

const trimmed = (value: string | undefined): string => value?.trim() ?? "";

export const hasEspnCredentials = (credentials: LeagueSyncCredentials | undefined): boolean =>
  trimmed(credentials?.espnS2).length > 0 && trimmed(credentials?.swid).length > 0;

export const espnCookieHeader = (
  credentials: LeagueSyncCredentials | undefined,
): Record<string, string> => hasEspnCredentials(credentials)
  ? { cookie: `espn_s2=${trimmed(credentials?.espnS2)}; SWID=${trimmed(credentials?.swid)}` }
  : {};

export const fetchEspnLeaguePayload = async (
  providerLeagueId: string,
  season: string,
  options: LeagueSyncRequestOptions,
): Promise<Record<string, unknown>> => {
  try {
    return recordValue(await fetchLeagueSyncJson({
      ...options,
      headers: espnCookieHeader(options.credentials),
      providerLabel: espnProviderLabel,
      url: espnLeagueUrl(providerLeagueId, season),
    }));
  } catch (error) {
    // A refusal means different things depending on what the owner has already
    // given us: no cookies yet is a prompt, saved cookies is a repair.
    const needsFirstCookies = error instanceof LeagueSyncError &&
      error.code === "credentials_rejected" && !hasEspnCredentials(options.credentials);
    if (!needsFirstCookies) throw error;
    throw new LeagueSyncError(
      "credentials_required",
      "This ESPN league is private. Paste your espn_s2 and SWID cookies to connect it.",
    );
  }
};

export const espnDiscoveredLeague = (
  payload: Record<string, unknown>,
  providerLeagueId: string,
  season: string,
): DiscoveredLeague => {
  const settings = recordValue(payload.settings);
  return {
    providerLeagueId,
    name: optionalText(settings.name) ?? "ESPN league",
    season: optionalText(payload.seasonId) ?? season,
    teamCount: numberValue(settings.size, recordArray(payload.teams).length),
  };
};
