import {
  LeagueSyncError,
  type LeagueSyncCredentials,
  type LeagueSyncRequestOptions,
} from "./contracts.js";
import { optionalText, recordArray, recordValue } from "./decode.js";
import { fetchLeagueSyncJson } from "./httpJson.js";

const espnFanApiOrigin = "https://fan.api.espn.com";
const maximumDiscoveredLeagues = 50;
const leagueIdPattern = /^\d{1,20}$/u;

const trimmed = (value: string | undefined): string => value?.trim() ?? "";

const completeCredentials = (
  credentials: LeagueSyncCredentials | undefined,
): { espnS2: string; swid: string } | null => {
  const espnS2 = trimmed(credentials?.espnS2);
  const swid = trimmed(credentials?.swid);
  return espnS2.length === 0 || swid.length === 0 ? null : { espnS2, swid };
};

const footballEntry = (
  entry: Record<string, unknown>,
  preference: Record<string, unknown>,
): boolean => {
  const gameId = entry.gameId;
  if (typeof gameId === "number") return gameId === 1;
  if (typeof gameId === "string" && gameId.trim().length > 0) {
    const normalized = gameId.trim().toLowerCase();
    return normalized === "1" || normalized === "ffl";
  }
  const markers = [entry.abbrev, entry.gameAbbrev, preference.abbrev];
  const namedMarker = markers.find(marker => typeof marker === "string" && marker.trim().length > 0);
  return namedMarker === undefined || String(namedMarker).toLowerCase().includes("ffl");
};

const seasonFor = (
  entry: Record<string, unknown>,
  preference: Record<string, unknown>,
): string | undefined => {
  for (const value of [entry.seasonId, preference.seasonId]) {
    const text = optionalText(value);
    if (text !== undefined && /^\d{4}$/u.test(text)) return text;
  }
  return undefined;
};

const leagueIdFor = (group: Record<string, unknown>): string | undefined => {
  const raw = group.groupId ?? group.id;
  const text = optionalText(raw);
  return text !== undefined && leagueIdPattern.test(text) ? text : undefined;
};

const entriesFor = (payload: unknown): readonly {
  entry: Record<string, unknown>;
  preference: Record<string, unknown>;
}[] => recordArray(recordValue(payload).preferences).flatMap(preference => {
  const metadata = recordValue(preference.metaData);
  const nested = recordValue(metadata.entry);
  const direct = recordValue(preference.entry);
  const entry = Object.keys(nested).length > 0 ? nested : direct;
  return Object.keys(entry).length === 0 ? [] : [{ entry, preference }];
});

export const discoverEspnAccountLeagueIds = async (
  season: string,
  options: LeagueSyncRequestOptions,
): Promise<readonly string[]> => {
  const credentials = completeCredentials(options.credentials);
  if (credentials === null) {
    throw new LeagueSyncError(
      "credentials_required",
      "Paste your ESPN espn_s2 and SWID cookies to find every league on your account.",
    );
  }
  const payload = await fetchLeagueSyncJson({
    ...options,
    headers: {
      cookie: `espn_s2=${credentials.espnS2}; SWID=${credentials.swid}`,
    },
    providerLabel: "ESPN",
    url: new URL(`/apis/v2/fans/${encodeURIComponent(credentials.swid)}`, espnFanApiOrigin).toString(),
  });
  const ids = new Set<string>();
  for (const { entry, preference } of entriesFor(payload)) {
    if (!footballEntry(entry, preference)) continue;
    const entrySeason = seasonFor(entry, preference);
    if (entrySeason !== undefined && entrySeason !== season) continue;
    for (const group of recordArray(entry.groups)) {
      const leagueId = leagueIdFor(group);
      if (leagueId !== undefined) ids.add(leagueId);
      if (ids.size >= maximumDiscoveredLeagues) return [...ids];
    }
  }
  return [...ids];
};
