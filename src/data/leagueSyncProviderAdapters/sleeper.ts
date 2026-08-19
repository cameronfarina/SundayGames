import {
  LeagueSyncError,
  type DiscoverLeaguesInput,
  type DiscoveredLeague,
  type FetchLeagueInput,
  type LeagueSyncAdapter,
  type LeagueSyncRequestOptions,
  type PlayerDirectory,
  type SyncedLeague,
} from "./contracts.js";
import {
  numberMap,
  numberValue,
  optionalNumber,
  optionalText,
  recordArray,
  recordValue,
  stringArray,
  textValue,
} from "./decode.js";
import { fetchLeagueSyncJson } from "./httpJson.js";
import { sleeperPlayerDirectory } from "./sleeperPlayerDirectory.js";
import { startingSlotsFor, teamsFor, type SleeperUserRecord } from "./sleeperTeams.js";
import { matchupsFor } from "./sleeperMatchups.js";

export const sleeperApiOrigin = "https://api.sleeper.app";
export const sleeperProviderLabel = "Sleeper";
/** Sleeper seasons run 18 weeks; a corrupt leg value must not fan out past that. */
export const sleeperMaximumWeek = 18;

const sleeperJson = async (
  path: string,
  options: LeagueSyncRequestOptions,
): Promise<unknown> => await fetchLeagueSyncJson({
  ...options,
  providerLabel: sleeperProviderLabel,
  url: `${sleeperApiOrigin}${path}`,
});

const userIdFor = async (
  handle: string,
  options: LeagueSyncRequestOptions,
): Promise<string> => {
  const user = recordValue(await sleeperJson(`/v1/user/${encodeURIComponent(handle)}`, options));
  const userId = optionalText(user.user_id);
  if (userId === undefined) {
    throw new LeagueSyncError("league_not_found", `Sleeper has no user named "${handle}".`);
  }
  return userId;
};

const discoverLeagues = async (input: DiscoverLeaguesInput): Promise<readonly DiscoveredLeague[]> => {
  const handle = input.handle.trim().replace(/^@/u, "");
  if (handle.length === 0) {
    throw new LeagueSyncError("league_not_found", "Enter your Sleeper username.");
  }
  const userId = await userIdFor(handle, input);
  const leagues = recordArray(await sleeperJson(
    `/v1/user/${encodeURIComponent(userId)}/leagues/nfl/${encodeURIComponent(input.season)}`,
    input,
  ));

  return leagues.flatMap(league => {
    const providerLeagueId = optionalText(league.league_id);
    if (providerLeagueId === undefined) return [];
    return [{
      providerLeagueId,
      name: optionalText(league.name) ?? "Sleeper league",
      season: optionalText(league.season) ?? input.season,
      teamCount: numberValue(league.total_rosters),
    }];
  });
};

/** Only weeks Sleeper has already scored have matchups worth showing. */
const scoredWeekCount = (settings: Record<string, unknown>): number => {
  const scored = optionalNumber(settings.last_scored_leg) ?? 0;
  return Math.min(Math.max(Math.trunc(scored), 0), sleeperMaximumWeek);
};

const fetchLeague = async (
  input: FetchLeagueInput,
  directory: PlayerDirectory,
): Promise<SyncedLeague> => {
  const leaguePath = `/v1/league/${encodeURIComponent(input.providerLeagueId)}`;
  const league = recordValue(await sleeperJson(leaguePath, input));
  if (optionalText(league.league_id) === undefined) {
    throw new LeagueSyncError("league_not_found", "Sleeper has no league with that ID.");
  }
  const settings = recordValue(league.settings);
  const users: readonly SleeperUserRecord[] = recordArray(await sleeperJson(`${leaguePath}/users`, input));
  const rosters = recordArray(await sleeperJson(`${leaguePath}/rosters`, input));
  const weeks = await Promise.all(
    Array.from({ length: scoredWeekCount(settings) }, (_unused, index) => index + 1)
      .map(async week => ({
        week,
        rows: recordArray(await sleeperJson(`${leaguePath}/matchups/${week}`, input)),
      })),
  );

  const rosterPositions = stringArray(league.roster_positions);

  return {
    provider: "sleeper",
    providerLeagueId: input.providerLeagueId,
    settings: {
      name: optionalText(league.name) ?? "Sleeper league",
      season: optionalText(league.season) ?? input.season,
      teamCount: numberValue(league.total_rosters, rosters.length),
      rosterPositions,
      scoring: numberMap(league.scoring_settings),
      ...(optionalText(league.status) === undefined ? {} : { status: textValue(league.status) }),
      ...(optionalNumber(settings.playoff_teams) === undefined
        ? {} : { playoffTeams: numberValue(settings.playoff_teams) }),
      ...(optionalNumber(settings.playoff_week_start) === undefined
        ? {} : { playoffWeekStart: numberValue(settings.playoff_week_start) }),
      ...(optionalNumber(settings.waiver_budget) === undefined
        ? {} : { waiverBudget: numberValue(settings.waiver_budget) }),
    },
    teams: teamsFor(rosters, users, directory, startingSlotsFor(rosterPositions)),
    matchups: weeks.flatMap(({ week, rows }) => matchupsFor(week, rows)),
  };
};

export const sleeperLeagueSyncAdapter: LeagueSyncAdapter = {
  provider: "sleeper",
  isAvailable: () => true,
  needsPlayerDirectory: true,
  fetchPlayerDirectory: async options =>
    sleeperPlayerDirectory(await sleeperJson("/v1/players/nfl", options)),
  discoverLeagues,
  fetchLeague,
};
