import {
  espnFanProfilePayload,
  espnLeaguePayload,
  espnPrivateLeagueErrorBody,
  sleeperDraftsPayload,
  sleeperLeaguePayload,
  sleeperLeagueUsersPayload,
  sleeperMatchupsWeekOnePayload,
  sleeperPlayersPayload,
  sleeperRostersPayload,
  sleeperUserLeaguesPayload,
  sleeperUserPayload,
} from "../../leagueSyncFixtures.js";
import {
  expectBodyRecord,
  expectString,
  type PlatformHttpHandler,
} from "../support/index.js";
import type { StubRoute } from "./harness.js";

export const sleeperRoutes: readonly StubRoute[] = [
  { match: "/v1/user/feiyingx", body: sleeperUserPayload },
  { match: "/leagues/nfl/2018", body: sleeperUserLeaguesPayload },
  { match: "/matchups/1", body: sleeperMatchupsWeekOnePayload },
  { match: "/users", body: sleeperLeagueUsersPayload },
  { match: "/rosters", body: sleeperRostersPayload },
  { match: "/players/nfl", body: sleeperPlayersPayload },
  { match: "/drafts", body: sleeperDraftsPayload },
  { match: "/v1/league/289646328504385536", body: sleeperLeaguePayload },
];

export const espnRoutes: readonly StubRoute[] = [
  { match: "/leagues/899513", body: espnLeaguePayload },
  { match: "/leagues/1?", body: espnPrivateLeagueErrorBody, status: 401 },
];

export const espnAccountRoutes: readonly StubRoute[] = [
  { match: "fan.api.espn.com", body: espnFanProfilePayload },
  ...espnRoutes,
];

export const sleeperOutageRoutes: readonly StubRoute[] = [
  ...sleeperRoutes.filter(route => route.match !== "/v1/league/289646328504385536"),
  { match: "/v1/league/289646328504385536", body: {}, status: 503 },
];

export const connectionIdFrom = (body: unknown): string =>
  expectString(expectBodyRecord(expectBodyRecord(body).connection).id);

export const connectSleeperLeague = async (
  handle: PlatformHttpHandler,
  sessionToken: string,
  now: Date,
) => await handle({
  method: "POST",
  path: "/league-connections",
  sessionToken,
  now,
  body: {
    provider: "sleeper",
    providerLeagueId: "289646328504385536",
    season: "2018",
    displayName: "Sleeper Friends League",
  },
});
