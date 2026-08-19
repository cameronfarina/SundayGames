import {
  LeagueSyncError,
  type DiscoverLeaguesInput,
  type DiscoveredLeague,
  type FetchLeagueInput,
  type LeagueSyncAdapter,
  type LeagueSyncCredentials,
  type LeagueSyncRequestOptions,
  type SyncedLeague,
} from "./contracts.js";
import { numberValue, optionalText, recordArray, recordValue } from "./decode.js";
import { discoverEspnAccountLeagueIds } from "./espnAccountDiscovery.js";
import { espnRosterPositions, espnScoring } from "./espnSettings.js";
import { espnMatchupsFor, espnTeamsFor } from "./espnTeams.js";
import { fetchLeagueSyncJson } from "./httpJson.js";

export const espnApiOrigin = "https://lm-api-reads.fantasy.espn.com";
export const espnProviderLabel = "ESPN";

const leagueViews: readonly string[] = ["mSettings", "mTeam", "mRoster", "mMatchup"];

const espnLeagueUrl = (providerLeagueId: string, season: string): string => {
  const path = `/apis/v3/games/ffl/seasons/${encodeURIComponent(season)}` +
    `/segments/0/leagues/${encodeURIComponent(providerLeagueId)}`;
  const url = new URL(path, espnApiOrigin);
  for (const view of leagueViews) url.searchParams.append("view", view);
  return url.toString();
};

const trimmed = (value: string | undefined): string => value?.trim() ?? "";

const hasCredentials = (credentials: LeagueSyncCredentials | undefined): boolean =>
  trimmed(credentials?.espnS2).length > 0 && trimmed(credentials?.swid).length > 0;

const cookieHeader = (
  credentials: LeagueSyncCredentials | undefined,
): Record<string, string> => hasCredentials(credentials)
  ? { cookie: `espn_s2=${trimmed(credentials?.espnS2)}; SWID=${trimmed(credentials?.swid)}` }
  : {};

const fetchLeaguePayload = async (
  providerLeagueId: string,
  season: string,
  options: LeagueSyncRequestOptions,
): Promise<Record<string, unknown>> => {
  try {
    return recordValue(await fetchLeagueSyncJson({
      ...options,
      headers: cookieHeader(options.credentials),
      providerLabel: espnProviderLabel,
      url: espnLeagueUrl(providerLeagueId, season),
    }));
  } catch (error) {
    const needsFirstCookies = error instanceof LeagueSyncError &&
      error.code === "credentials_rejected" && !hasCredentials(options.credentials);
    if (!needsFirstCookies) throw error;
    throw new LeagueSyncError(
      "credentials_required",
      "This ESPN league is private. Paste your espn_s2 and SWID cookies to connect it.",
    );
  }
};

const statusFor = (payload: Record<string, unknown>): string | undefined => {
  const status = recordValue(payload.status);
  if (status.isExpired === true) return "complete";
  return status.isActive === true ? "in_season" : undefined;
};

const discoveredLeagueFor = (
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

const discoverLeagues = async (input: DiscoverLeaguesInput): Promise<readonly DiscoveredLeague[]> => {
  const handle = input.handle.trim();
  const leagueIds = handle.length > 0
    ? [handle]
    : await discoverEspnAccountLeagueIds(input.season, input);
  return await Promise.all(leagueIds.map(async providerLeagueId => discoveredLeagueFor(
    await fetchLeaguePayload(providerLeagueId, input.season, input),
    providerLeagueId,
    input.season,
  )));
};

const fetchLeague = async (input: FetchLeagueInput): Promise<SyncedLeague> => {
  const payload = await fetchLeaguePayload(input.providerLeagueId, input.season, input);
  const settings = recordValue(payload.settings);
  const discovered = discoveredLeagueFor(payload, input.providerLeagueId, input.season);
  const status = statusFor(payload);

  return {
    provider: "espn",
    providerLeagueId: input.providerLeagueId,
    settings: {
      name: discovered.name,
      season: discovered.season,
      teamCount: discovered.teamCount,
      rosterPositions: espnRosterPositions(settings),
      scoring: espnScoring(settings),
      ...(status === undefined ? {} : { status }),
    },
    teams: espnTeamsFor(payload),
    matchups: espnMatchupsFor(payload),
  };
};

export const espnLeagueSyncAdapter: LeagueSyncAdapter = {
  provider: "espn",
  isAvailable: () => true,
  needsPlayerDirectory: false,
  discoverLeagues,
  fetchLeague,
};
