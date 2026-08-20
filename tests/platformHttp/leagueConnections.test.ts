import { createLeagueConnectionsHarness, syncNow } from "./leagueConnections/harness.js";
import { espnAccountRoutes, espnRoutes, sleeperRoutes } from "./leagueConnections/routes.js";
import {
  describe,
  expect,
  expectBodyRecord,
  expectRecordArray,
  it,
} from "./support/index.js";

describe("league connections HTTP", () => {
  it("requires a signed-in account", async () => {
    const harness = await createLeagueConnectionsHarness(sleeperRoutes);

    const response = await harness.handle({ method: "GET", path: "/league-connections" });

    expect(response.status).toBe(401);
  });

  it("reports that connected leagues are off when no repository is configured", async () => {
    const harness = await createLeagueConnectionsHarness(sleeperRoutes, { withRepository: false });

    const response = await harness.handle({
      method: "GET",
      path: "/league-connections",
      sessionToken: harness.sessionToken,
    });

    expect(response.status).toBe(503);
    expect(expectBodyRecord(response.body))
      .toMatchObject({ error: { code: "league_connections_unavailable" } });
  });

  it("lists no connections and every provider before the owner connects one", async () => {
    const harness = await createLeagueConnectionsHarness(sleeperRoutes);

    const response = await harness.handle({
      method: "GET",
      path: "/league-connections",
      sessionToken: harness.sessionToken,
    });
    const body = expectBodyRecord(response.body);

    expect(response.status).toBe(200);
    expect(body.connections).toEqual([]);
    const providers = expectRecordArray(body.providers);
    expect(providers.map(provider => provider.provider)).toEqual(["sleeper", "espn", "yahoo"]);
    expect(providers.find(provider => provider.provider === "yahoo")).toMatchObject({
      availability: "unavailable",
      detail: expect.stringContaining("reviews every Fantasy API application"),
    });
  });

  it("finds a Sleeper owner's leagues from a username", async () => {
    const harness = await createLeagueConnectionsHarness(sleeperRoutes);

    const response = await harness.handle({
      method: "POST",
      path: "/league-connections/discover",
      sessionToken: harness.sessionToken,
      body: { provider: "sleeper", handle: "feiyingx", season: "2018" },
    });
    const body = expectBodyRecord(response.body);

    expect(response.status).toBe(200);
    expect(expectRecordArray(body.leagues)).toEqual([{
      providerLeagueId: "289646328504385536",
      name: "Sleeper Friends League",
      season: "2018",
      teamCount: 12,
    }]);
  });

  it("accepts an ESPN league URL and looks up the league behind it", async () => {
    const harness = await createLeagueConnectionsHarness(espnRoutes);

    const response = await harness.handle({
      method: "POST",
      path: "/league-connections/discover",
      sessionToken: harness.sessionToken,
      body: {
        provider: "espn",
        handle: "https://fantasy.espn.com/football/league?leagueId=899513",
        season: "2025",
      },
    });

    expect(response.status).toBe(200);
    expect(harness.requests[0]).toContain("/leagues/899513");
  });

  it("rejects an ESPN handle that is neither an id nor a league URL", async () => {
    const harness = await createLeagueConnectionsHarness(espnRoutes);

    const response = await harness.handle({
      method: "POST",
      path: "/league-connections/discover",
      sessionToken: harness.sessionToken,
      body: { provider: "espn", handle: "my league", season: "2025" },
    });

    expect(response.status).toBe(404);
    expect(expectBodyRecord(response.body)).toMatchObject({
      error: { code: "league_not_found" },
    });
  });

  it("finds every ESPN league on the account from cookies alone", async () => {
    const harness = await createLeagueConnectionsHarness(espnAccountRoutes);

    const response = await harness.handle({
      method: "POST",
      path: "/league-connections/discover",
      sessionToken: harness.sessionToken,
      body: {
        provider: "espn",
        handle: "",
        season: "2025",
        espnS2: "s2-value",
        swid: "{GUID}",
      },
    });
    const body = expectBodyRecord(response.body);

    expect(response.status).toBe(200);
    expect(expectRecordArray(body.leagues)).toEqual([{
      providerLeagueId: "899513",
      name: "Pigskin Power Bottoms",
      season: "2025",
      teamCount: 12,
    }]);
    expect(harness.requests[0]).toContain("fan.api.espn.com");
  });

  it("asks for ESPN cookies when no league id is given either", async () => {
    const harness = await createLeagueConnectionsHarness(espnAccountRoutes);

    const response = await harness.handle({
      method: "POST",
      path: "/league-connections/discover",
      sessionToken: harness.sessionToken,
      body: { provider: "espn", handle: "", season: "2025" },
    });

    expect(response.status).toBe(422);
    expect(expectBodyRecord(response.body))
      .toMatchObject({ error: { code: "credentials_required" } });
  });

  it("still needs a username before looking up Sleeper", async () => {
    const harness = await createLeagueConnectionsHarness(sleeperRoutes);

    const response = await harness.handle({
      method: "POST",
      path: "/league-connections/discover",
      sessionToken: harness.sessionToken,
      body: { provider: "sleeper", handle: "", season: "2018" },
    });

    expect(response.status).toBe(400);
    expect(expectBodyRecord(response.body)).toMatchObject({ error: { code: "handle_required" } });
  });

  it("refuses a provider this app does not sync", async () => {
    const harness = await createLeagueConnectionsHarness(sleeperRoutes);

    const response = await harness.handle({
      method: "POST",
      path: "/league-connections/discover",
      sessionToken: harness.sessionToken,
      body: { provider: "nfl-dot-com", handle: "anything" },
    });

    expect(response.status).toBe(400);
    expect(expectBodyRecord(response.body)).toMatchObject({ error: { code: "unknown_provider" } });
  });

  it("explains that Yahoo is still waiting on approval instead of failing blankly", async () => {
    const harness = await createLeagueConnectionsHarness(sleeperRoutes);

    const response = await harness.handle({
      method: "POST",
      path: "/league-connections/discover",
      sessionToken: harness.sessionToken,
      body: { provider: "yahoo", handle: "any-league" },
    });

    expect(response.status).toBe(503);
    expect(expectBodyRecord(response.body))
      .toMatchObject({ error: { code: "provider_unavailable" } });
  });

  it("does not answer an unknown league-connections path", async () => {
    const harness = await createLeagueConnectionsHarness(sleeperRoutes);

    const response = await harness.handle({
      method: "GET",
      path: "/league-connections/some-id/teams/1",
      sessionToken: harness.sessionToken,
    });

    expect(response.status).toBe(404);
  });
});
