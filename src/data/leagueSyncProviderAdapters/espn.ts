import type {
  DiscoverLeaguesInput,
  DiscoveredLeague,
  FetchLeagueInput,
  LeagueSyncAdapter,
  SyncedLeague,
} from "./contracts.js";
import { recordValue } from "./decode.js";
import { espnDiscoveredLeague, fetchEspnLeaguePayload } from "./espnLeagueRequest.js";
import { espnDraftSettings, espnRosterPositions, espnScoring } from "./espnSettings.js";
import { espnMatchupsFor, espnTeamsFor } from "./espnTeams.js";

export { espnApiOrigin } from "./espnLeagueRequest.js";

const statusFor = (payload: Record<string, unknown>): string | undefined => {
  const status = recordValue(payload.status);
  if (status.isExpired === true) return "complete";
  return status.isActive === true ? "in_season" : undefined;
};

const fetchLeague = async (input: FetchLeagueInput): Promise<SyncedLeague> => {
  const payload = await fetchEspnLeaguePayload(input.providerLeagueId, input.season, input);
  const settings = recordValue(payload.settings);
  const discovered = espnDiscoveredLeague(payload, input.providerLeagueId, input.season);
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
      ...espnDraftSettings(settings),
    },
    teams: espnTeamsFor(payload),
    matchups: espnMatchupsFor(payload),
  };
};

const discoverLeagues = async (
  input: DiscoverLeaguesInput,
): Promise<readonly DiscoveredLeague[]> => {
  return [espnDiscoveredLeague(
    await fetchEspnLeaguePayload(input.handle, input.season, input),
    input.handle,
    input.season,
  )];
};

export const espnLeagueSyncAdapter: LeagueSyncAdapter = {
  provider: "espn",
  isAvailable: () => true,
  needsPlayerDirectory: false,
  discoverLeagues,
  fetchLeague,
};
