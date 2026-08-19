import { describe, expect, it } from "vitest";
import {
  LeagueSyncError,
  isLeagueSyncProvider,
  leagueSyncAdapters,
  type LeagueSyncFetch,
} from "../src/data/leagueSyncProviderAdapters.js";
import { sleeperPlayerDirectory } from "../src/data/leagueSyncProviderAdapters/sleeperPlayerDirectory.js";
import {
  espnLeaguePayload,
  espnPrivateLeagueErrorBody,
  sleeperLeaguePayload,
  sleeperLeagueUsersPayload,
  sleeperMatchupsWeekOnePayload,
  sleeperPlayersPayload,
  sleeperRostersPayload,
  sleeperUserLeaguesPayload,
  sleeperUserPayload,
} from "./leagueSyncFixtures.js";

interface StubRoute {
  body?: unknown;
  match: string;
  status?: number;
}

const stubFetch = (routes: readonly StubRoute[]): {
  fetcher: LeagueSyncFetch;
  requests: string[];
} => {
  const requests: string[] = [];
  const fetcher: LeagueSyncFetch = async (url, init) => {
    requests.push(url);
    const route = routes.find(candidate => url.includes(candidate.match));
    if (route === undefined) throw new Error(`No stub for ${url}`);
    return new Response(JSON.stringify(route.body ?? {}), {
      status: route.status ?? 200,
      headers: { ...(init.headers === undefined ? {} : {}) },
    });
  };
  return { fetcher, requests };
};

const sleeperRoutes: readonly StubRoute[] = [
  { match: "/v1/user/feiyingx", body: sleeperUserPayload },
  { match: "/leagues/nfl/2018", body: sleeperUserLeaguesPayload },
  { match: "/matchups/1", body: sleeperMatchupsWeekOnePayload },
  { match: "/users", body: sleeperLeagueUsersPayload },
  { match: "/rosters", body: sleeperRostersPayload },
  { match: "/players/nfl", body: sleeperPlayersPayload },
  { match: "/v1/league/289646328504385536", body: sleeperLeaguePayload },
];

const directory = sleeperPlayerDirectory(sleeperPlayersPayload);

describe("sleeper league sync adapter", () => {
  it("lists a user's leagues for one season and skips rows with no league id", async () => {
    const { fetcher, requests } = stubFetch(sleeperRoutes);

    const leagues = await leagueSyncAdapters.sleeper.discoverLeagues({
      handle: " @feiyingx ",
      season: "2018",
      fetcher,
    });

    expect(leagues).toEqual([{
      providerLeagueId: "289646328504385536",
      name: "Sleeper Friends League",
      season: "2018",
      teamCount: 12,
    }]);
    expect(requests[0]).toContain("/v1/user/feiyingx");
  });

  it("refuses an unknown username without pretending the provider failed", async () => {
    const { fetcher } = stubFetch([{ match: "/v1/user/", body: {} }]);

    await expect(leagueSyncAdapters.sleeper.discoverLeagues({
      handle: "ghost",
      season: "2018",
      fetcher,
    })).rejects.toMatchObject({ code: "league_not_found" });
  });

  it("asks for a username before spending a request", async () => {
    const { fetcher, requests } = stubFetch(sleeperRoutes);

    await expect(leagueSyncAdapters.sleeper.discoverLeagues({
      handle: "   ",
      season: "2018",
      fetcher,
    })).rejects.toBeInstanceOf(LeagueSyncError);
    expect(requests).toEqual([]);
  });

  it("builds teams, starters, bench, and paired matchups from a live league shape", async () => {
    const { fetcher, requests } = stubFetch(sleeperRoutes);

    const league = await leagueSyncAdapters.sleeper.fetchLeague({
      providerLeagueId: "289646328504385536",
      season: "2018",
      fetcher,
    }, directory);

    expect(league.settings).toEqual({
      name: "Sleeper Friends League",
      season: "2018",
      teamCount: 2,
      rosterPositions: ["QB", "RB", "RB", "WR", "FLEX", "DEF", "BN", "BN"],
      scoring: { rec: 1, pass_td: 4, bonus_rec_yd_100: 0.5 },
      status: "complete",
      playoffTeams: 6,
      playoffWeekStart: 14,
      waiverBudget: 100,
    });
    const [first] = league.teams;
    expect(first?.name).toBe("Giant Dolphins");
    expect(first?.ownerNames).toEqual(["2KSports", "feiyingx"]);
    expect(first?.pointsFor).toBeCloseTo(1776.06, 5);
    // "0" marks an empty starting slot, so the slot after it must not shift.
    expect(first?.players.map(player => [player.name, player.lineupSlot, player.starter])).toEqual([
      ["Alvin Kamara", "QB", true],
      ["Derrick Henry", "RB", true],
      ["Jordy Nelson", "WR", true],
      ["Philadelphia Eagles", "FLEX", true],
      ["1352", undefined, false],
    ]);
    expect(league.matchups).toEqual([
      { week: 1, matchupKey: "1-2", homeTeamId: "1", homePoints: 148.04, awayTeamId: "2", awayPoints: 101.5 },
      { week: 1, matchupKey: "1-bye-3", homeTeamId: "3", homePoints: 88.25 },
    ]);
    // last_scored_leg is 1, so exactly one week of matchups is requested.
    expect(requests.filter(url => url.includes("/matchups/"))).toHaveLength(1);
  });

  it("trims the player dump to the fields a roster renders", () => {
    expect(directory.PHI).toEqual({
      name: "Philadelphia Eagles",
      position: "DEF",
      teamAbbreviation: "PHI",
    });
    expect(directory["2133"]).toEqual({ name: "Jordy Nelson", position: "WR" });
    expect(directory["0000"]).toBeUndefined();
  });
});

const espnRoutes: readonly StubRoute[] = [{ match: "/leagues/899513", body: espnLeaguePayload }];

describe("espn league sync adapter", () => {
  it("reads a public league with no credentials", async () => {
    const { fetcher, requests } = stubFetch(espnRoutes);

    const league = await leagueSyncAdapters.espn.fetchLeague({
      providerLeagueId: "899513",
      season: "2025",
      fetcher,
    }, {});

    expect(requests[0]).toContain("lm-api-reads.fantasy.espn.com");
    expect(requests[0]).toContain("view=mSettings&view=mTeam&view=mRoster&view=mMatchup");
    expect(league.settings.name).toBe("Pigskin Power Bottoms");
    expect(league.settings.status).toBe("in_season");
    expect(league.settings.scoring).toEqual({
      rec_td: 6,
      pass_td: 4,
      pass_yd: 0.04,
      rec_yd: 0.1,
    });
    // Counts expand back into a slot list, and an unknown slot keeps its id.
    expect(league.settings.rosterPositions).toEqual([
      "TQB", "DP", "DST", "K", "BN", "BN", "IR", "FLEX", "FLEX", "99",
    ]);
  });

  it("names owners from the member list and sorts starters ahead of the bench", async () => {
    const { fetcher } = stubFetch(espnRoutes);

    const league = await leagueSyncAdapters.espn.fetchLeague({
      providerLeagueId: "899513",
      season: "2025",
      fetcher,
    }, {});

    const [first, second] = league.teams;
    expect(first?.ownerNames).toEqual(["ChadOwner", "Sam Cole"]);
    expect(second?.ownerNames).toEqual(["mfespinosaIV"]);
    expect(first?.players).toEqual([
      {
        providerPlayerId: "4242335",
        name: "Jonathan Taylor",
        position: "RB",
        teamAbbreviation: "IND",
        lineupSlot: "FLEX",
        starter: true,
      },
      {
        providerPlayerId: "3916655",
        name: "Maxx Crosby",
        position: "DE",
        teamAbbreviation: "LV",
        injuryStatus: "QUESTIONABLE",
        starter: false,
      },
    ]);
  });

  it("keeps a bye-week matchup and skips a row with no home side", async () => {
    const { fetcher } = stubFetch(espnRoutes);

    const league = await leagueSyncAdapters.espn.fetchLeague({
      providerLeagueId: "899513",
      season: "2025",
      fetcher,
    }, {});

    expect(league.matchups).toEqual([
      { week: 1, matchupKey: "1-1", homeTeamId: "2", homePoints: 112.24, awayTeamId: "10", awayPoints: 69.82 },
      { week: 1, matchupKey: "1-2", homeTeamId: "1", homePoints: 102.79 },
    ]);
  });

  it("asks for cookies the first time a private league refuses", async () => {
    const { fetcher } = stubFetch([
      { match: "/leagues/1", body: espnPrivateLeagueErrorBody, status: 401 },
    ]);

    await expect(leagueSyncAdapters.espn.fetchLeague({
      providerLeagueId: "1",
      season: "2025",
      fetcher,
    }, {})).rejects.toMatchObject({ code: "credentials_required" });
  });

  it("reports saved cookies as rejected rather than asking for them again", async () => {
    const { fetcher } = stubFetch([
      { match: "/leagues/1", body: espnPrivateLeagueErrorBody, status: 401 },
    ]);

    await expect(leagueSyncAdapters.espn.fetchLeague({
      providerLeagueId: "1",
      season: "2025",
      credentials: { espnS2: "cookie-value", swid: "{GUID}" },
      fetcher,
    }, {})).rejects.toMatchObject({ code: "credentials_rejected" });
  });

  it("sends both cookies when the league is private", async () => {
    const headers: (HeadersInit | undefined)[] = [];
    const fetcher: LeagueSyncFetch = async (_url, init) => {
      headers.push(init.headers);
      return new Response(JSON.stringify(espnLeaguePayload));
    };

    await leagueSyncAdapters.espn.discoverLeagues({
      handle: "899513",
      season: "2025",
      credentials: { espnS2: " s2-value ", swid: " {GUID} " },
      fetcher,
    });

    expect(headers[0]).toMatchObject({ cookie: "espn_s2=s2-value; SWID={GUID}" });
  });

  it("reports an unknown league as missing", async () => {
    const { fetcher } = stubFetch([{ match: "/leagues/", body: {}, status: 404 }]);

    await expect(leagueSyncAdapters.espn.discoverLeagues({
      handle: "12345",
      season: "2025",
      fetcher,
    })).rejects.toMatchObject({ code: "league_not_found" });
  });
});

describe("yahoo league sync adapter", () => {
  it("explains that access is still waiting on Yahoo rather than failing silently", async () => {
    await expect(leagueSyncAdapters.yahoo.discoverLeagues({ handle: "x", season: "2026" }))
      .rejects.toMatchObject({ code: "provider_unavailable" });
    await expect(leagueSyncAdapters.yahoo.fetchLeague(
      { providerLeagueId: "x", season: "2026" },
      {},
    )).rejects.toMatchObject({
      code: "provider_unavailable",
      message: expect.stringContaining("reviews every Fantasy API application"),
    });
    expect(leagueSyncAdapters.yahoo.isAvailable()).toBe(false);
  });
});

describe("provider names", () => {
  it("accepts only the three providers this app knows", () => {
    expect(isLeagueSyncProvider("sleeper")).toBe(true);
    expect(isLeagueSyncProvider("nfl")).toBe(false);
  });
});
