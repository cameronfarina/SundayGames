import {
  sleeperUserLeaguesPayload,
  sleeperUserPayload,
} from "../../leagueSyncFixtures.js";
import { expectBodyRecord, expectString, type PlatformHttpHandler } from "../support/index.js";
import { syncNow, type StubRoute } from "./harness.js";

/**
 * A four-team league is the smallest one Sunday Games will create, so these
 * payloads carry a whole importable league rather than the trimmed two-team
 * capture the sync tests read.
 */
const teamNumbers: readonly number[] = [1, 2, 3, 4];

const sleeperUsers = teamNumbers.map(number => ({
  user_id: `user-${number}`,
  display_name: `Owner ${number}`,
  metadata: { team_name: `Team ${number}` },
}));

const sleeperRosters = teamNumbers.map(number => ({
  roster_id: number,
  owner_id: `user-${number}`,
  players: [],
  starters: [],
  settings: { wins: 0, losses: 0, ties: 0, fpts: 0 },
}));

export const importableRosterPositions: readonly string[] = [
  "QB", "RB", "RB", "WR", "FLEX", "DEF", "K", "BN", "BN",
];

const sleeperLeague = (rosterPositions: readonly string[]) => ({
  league_id: "289646328504385536",
  name: "Sleeper Friends League",
  season: "2018",
  status: "in_season",
  total_rosters: teamNumbers.length,
  roster_positions: rosterPositions,
  scoring_settings: { rec: 1, pass_td: 4, rush_td: 6, rec_td: 6, pass_yd: 0.04, rec_yd: 0.1 },
  settings: { max_keepers: 1, last_scored_leg: 0 },
});

const routesFor = (rosterPositions: readonly string[]): readonly StubRoute[] => [
  { match: "/v1/user/feiyingx", body: sleeperUserPayload },
  { match: "/leagues/nfl/2018", body: sleeperUserLeaguesPayload },
  { match: "/users", body: sleeperUsers },
  { match: "/rosters", body: sleeperRosters },
  { match: "/players/nfl", body: {} },
  { match: "/drafts", body: [{ type: "snake", settings: { rounds: 9 } }] },
  { match: "/v1/league/289646328504385536", body: sleeperLeague(rosterPositions) },
];

export const importableRoutes = routesFor(importableRosterPositions);

export interface ChangeableLeagueRoutes {
  routes: readonly StubRoute[];
  renameLeague: (name: string) => void;
  dropOneTeam: () => void;
}

/**
 * The same league, but the payload can change between syncs: a re-sync only
 * matters when the provider is telling the app something new.
 */
export const changeableImportableRoutes = (): ChangeableLeagueRoutes => {
  const league = sleeperLeague(importableRosterPositions);
  const users = [...sleeperUsers];
  const rosters = [...sleeperRosters];

  return {
    routes: [
      { match: "/v1/user/feiyingx", body: sleeperUserPayload },
      { match: "/leagues/nfl/2018", body: sleeperUserLeaguesPayload },
      { match: "/users", body: users },
      { match: "/rosters", body: rosters },
      { match: "/players/nfl", body: {} },
      { match: "/drafts", body: [{ type: "snake", settings: { rounds: 9 } }] },
      { match: "/v1/league/289646328504385536", body: league },
    ],
    renameLeague: name => {
      league.name = name;
    },
    dropOneTeam: () => {
      users.pop();
      rosters.pop();
      league.total_rosters = rosters.length;
    },
  };
};

/** The same league with a defensive flex Sunday Games has no slot for. */
export const unsupportedSlotRoutes = routesFor([...importableRosterPositions, "IDP_FLEX"]);

export const connectImportableLeague = async (
  handle: PlatformHttpHandler,
  sessionToken: string,
): Promise<string> => {
  const created = await handle({
    method: "POST",
    path: "/league-connections",
    sessionToken,
    now: syncNow,
    body: {
      provider: "sleeper",
      providerLeagueId: "289646328504385536",
      season: "2018",
      displayName: "Sleeper Friends League",
    },
  });
  return expectString(expectBodyRecord(expectBodyRecord(created.body).connection).id);
};

export const syncConnection = async (
  handle: PlatformHttpHandler,
  sessionToken: string,
  connectionId: string,
) => await handle({
  method: "POST",
  path: `/league-connections/${connectionId}/sync`,
  sessionToken,
  now: syncNow,
});

export const importLeague = async (
  handle: PlatformHttpHandler,
  sessionToken: string,
  connectionId: string,
  body: Record<string, unknown> = { mode: "create" },
) => await handle({
  method: "POST",
  path: `/league-connections/${connectionId}/import`,
  sessionToken,
  now: syncNow,
  body,
});
