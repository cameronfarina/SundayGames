import { describe, expect, it } from "vitest";

import {
  leagueSyncAdapters,
  type LeagueSyncFetch,
} from "../src/data/leagueSyncProviderAdapters.js";
import {
  espnLeaguePayload,
  sleeperLeaguePayload,
  sleeperLeagueUsersPayload,
  sleeperMatchupsWeekOnePayload,
  sleeperRostersPayload,
} from "./leagueSyncFixtures.js";

interface StubRoute {
  body: unknown;
  match: string;
}

const stubFetch = (routes: readonly StubRoute[]): {
  fetcher: LeagueSyncFetch;
  requests: Array<{ url: string; headers: HeadersInit | undefined }>;
} => {
  const requests: Array<{ url: string; headers: HeadersInit | undefined }> = [];
  return {
    requests,
    fetcher: async (url, init) => {
      requests.push({ url, headers: init.headers });
      const route = routes.find(candidate => url.includes(candidate.match));
      if (route === undefined) throw new Error(`No stub for ${url}`);
      return new Response(JSON.stringify(route.body));
    },
  };
};

describe("Sleeper draft metadata", () => {
  it("imports a snake draft order from the league draft", async () => {
    const { fetcher } = stubFetch([
      { match: "/drafts", body: [{ draft_id: "draft-1", season: "2018" }] },
      {
        match: "/v1/draft/draft-1",
        body: {
          draft_id: "draft-1",
          season: "2018",
          type: "snake",
          settings: { rounds: 8 },
          slot_to_roster_id: { "1": 2, "2": 1 },
        },
      },
      { match: "/users", body: sleeperLeagueUsersPayload },
      { match: "/rosters", body: sleeperRostersPayload },
      { match: "/matchups/1", body: sleeperMatchupsWeekOnePayload },
      { match: "/v1/league/289646328504385536", body: sleeperLeaguePayload },
    ]);

    const league = await leagueSyncAdapters.sleeper.fetchLeague({
      providerLeagueId: "289646328504385536",
      season: "2018",
      fetcher,
    }, {});

    expect(league.settings.draft).toEqual({
      type: "snake",
      rounds: 8,
      order: ["2", "1"],
    });
  });
});

describe("ESPN account discovery", () => {
  it("discovers account leagues with cookies and then reads each league", async () => {
    const fanPayload = {
      preferences: [{
        metaData: {
          entry: {
            gameId: 1,
            seasonId: 2025,
            groups: [
              { groupId: "899513" },
              { groupId: "899513" },
              { groupId: "not-a-league" },
            ],
          },
        },
      }],
    };
    const { fetcher, requests } = stubFetch([
      { match: "fan.api.espn.com/apis/v2/fans/", body: fanPayload },
      { match: "/leagues/899513", body: espnLeaguePayload },
    ]);

    const leagues = await leagueSyncAdapters.espn.discoverLeagues({
      handle: "",
      season: "2025",
      credentials: { espnS2: "s2-value", swid: "{GUID}" },
      fetcher,
    });

    expect(leagues).toEqual([{
      providerLeagueId: "899513",
      name: "Pigskin Power Bottoms",
      season: "2025",
      teamCount: 12,
    }]);
    expect(requests.map(request => request.url)).toEqual(expect.arrayContaining([
      expect.stringContaining("fan.api.espn.com/apis/v2/fans/"),
      expect.stringContaining("/leagues/899513"),
    ]));
    expect(requests[0]?.headers).toMatchObject({
      cookie: "espn_s2=s2-value; SWID={GUID}",
    });
  });

  it("requires both cookies for account-wide discovery", async () => {
    const { fetcher, requests } = stubFetch([]);

    await expect(leagueSyncAdapters.espn.discoverLeagues({
      handle: "",
      season: "2025",
      credentials: { espnS2: "s2-value" },
      fetcher,
    })).rejects.toMatchObject({ code: "credentials_required" });
    expect(requests).toEqual([]);
  });

  it("keeps direct league discovery available without account cookies", async () => {
    const { fetcher, requests } = stubFetch([
      { match: "/leagues/899513", body: espnLeaguePayload },
    ]);

    const leagues = await leagueSyncAdapters.espn.discoverLeagues({
      handle: "899513",
      season: "2025",
      fetcher,
    });

    expect(leagues).toHaveLength(1);
    expect(requests.some(request => request.url.includes("fan.api.espn.com"))).toBe(false);
  });
});
