import {
  LeagueSyncError,
  type DiscoverLeaguesInput,
  type DiscoveredLeague,
} from "./contracts.js";
import { optionalText, recordArray, recordValue, textValue } from "./decode.js";
import {
  espnCookieHeader,
  espnDiscoveredLeague,
  espnProviderLabel,
  fetchEspnLeaguePayload,
  hasEspnCredentials,
} from "./espnLeagueRequest.js";
import { fetchLeagueSyncJson } from "./httpJson.js";

export const espnFanApiOrigin = "https://fan.api.espn.com";

const fantasyFootballGameId = "ffl";
const entryUrlLeagueId = /[?&]leagueId=(\d+)/u;

export const espnFanProfileUrl = (swid: string): string =>
  new URL(`/apis/v2/fans/${encodeURIComponent(swid.trim())}`, espnFanApiOrigin).toString();

/**
 * ESPN has moved the league id around its fan profile between revisions and
 * omits it entirely from some entries, so every place it has appeared is tried
 * before the entry link the team card points at.
 */
const leagueIdFor = (entity: Record<string, unknown>): string | undefined =>
  optionalText(entity.leagueId)
  ?? optionalText(entity.groupId)
  ?? entryUrlLeagueId.exec(textValue(entity.entryURL))?.[1];

/**
 * A profile entry that names no season is kept: the league request is already
 * season-scoped, so ESPN answers 404 for a league that did not run that year
 * and the entry drops out on its own.
 */
const belongsToSeason = (entity: Record<string, unknown>, season: string): boolean => {
  const seasonId = optionalText(entity.seasonId);
  return seasonId === undefined || seasonId === season;
};

export const espnFanLeagueIds = (payload: unknown, season: string): readonly string[] => {
  const leagueIds = recordArray(recordValue(payload).preferences).flatMap(preference => {
    const entity = recordValue(recordValue(preference.metaData).entity);
    if (textValue(entity.gameId).toLowerCase() !== fantasyFootballGameId) return [];
    if (!belongsToSeason(entity, season)) return [];
    const leagueId = leagueIdFor(entity);
    return leagueId === undefined ? [] : [leagueId];
  });

  // A co-managed league can appear once per team the account holds in it.
  return [...new Set(leagueIds)];
};

/**
 * Lists every fantasy football league the signed-in ESPN account plays in. The
 * fan profile names the leagues but not their size, so each one is read through
 * the same league request the single-league path uses. A league the account can
 * no longer open is skipped rather than failing the whole list.
 */
export const espnAccountLeagues = async (
  input: DiscoverLeaguesInput,
): Promise<readonly DiscoveredLeague[]> => {
  if (!hasEspnCredentials(input.credentials)) {
    throw new LeagueSyncError(
      "credentials_required",
      "Paste your espn_s2 and SWID cookies to find the leagues on your ESPN account.",
    );
  }
  const profile = await fetchLeagueSyncJson({
    ...input,
    headers: espnCookieHeader(input.credentials),
    providerLabel: espnProviderLabel,
    url: espnFanProfileUrl(textValue(input.credentials?.swid)),
  });

  const leagues = await Promise.all(espnFanLeagueIds(profile, input.season).map(
    async leagueId => {
      try {
        return [espnDiscoveredLeague(
          await fetchEspnLeaguePayload(leagueId, input.season, input),
          leagueId,
          input.season,
        )];
      } catch {
        return [];
      }
    },
  ));

  return leagues.flat();
};
