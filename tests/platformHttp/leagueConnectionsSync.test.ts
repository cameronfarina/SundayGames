import { createLeagueConnectionsHarness, syncNow } from "./leagueConnections/harness.js";
import {
  connectSleeperLeague,
  connectionIdFrom,
  espnRoutes,
  sleeperOutageRoutes,
  sleeperRoutes,
} from "./leagueConnections/routes.js";
import {
  describe,
  expect,
  expectBodyRecord,
  expectPublicBrowserPayload,
  expectRecordArray,
  expectString,
  it,
} from "./support/index.js";

describe("league connection sync HTTP", () => {
  it("connects a Sleeper league and stores its teams and matchups", async () => {
    const harness = await createLeagueConnectionsHarness(sleeperRoutes);

    const created = await connectSleeperLeague(harness.handle, harness.sessionToken, syncNow);
    const detail = await harness.handle({
      method: "GET",
      path: `/league-connections/${connectionIdFrom(created.body)}`,
      sessionToken: harness.sessionToken,
    });
    const league = expectBodyRecord(expectBodyRecord(detail.body).league);

    expect(created.status).toBe(201);
    expect(expectBodyRecord(expectBodyRecord(created.body).connection)).toMatchObject({
      status: "ok",
      lastSyncedAt: syncNow.toISOString(),
    });
    expect(expectRecordArray(league.teams)).toHaveLength(2);
    expect(expectRecordArray(league.matchups)).toHaveLength(2);
    expectPublicBrowserPayload(detail.body);
  });

  it("serves a connection with no league yet rather than a broken page", async () => {
    const harness = await createLeagueConnectionsHarness(sleeperOutageRoutes);

    const created = await connectSleeperLeague(harness.handle, harness.sessionToken, syncNow);
    const detail = await harness.handle({
      method: "GET",
      path: `/league-connections/${connectionIdFrom(created.body)}`,
      sessionToken: harness.sessionToken,
    });

    expect(expectBodyRecord(detail.body).league).toBeNull();
  });

  it("keeps ESPN cookies out of every response after they are saved", async () => {
    const harness = await createLeagueConnectionsHarness(espnRoutes);

    const created = await harness.handle({
      method: "POST",
      path: "/league-connections",
      sessionToken: harness.sessionToken,
      now: syncNow,
      body: {
        provider: "espn",
        providerLeagueId: "899513",
        season: "2025",
        espnS2: "secret-cookie-value",
        swid: "{SECRET-GUID}",
      },
    });
    const listed = await harness.handle({
      method: "GET",
      path: "/league-connections",
      sessionToken: harness.sessionToken,
    });

    const serialized = JSON.stringify([created.body, listed.body]);
    expect(serialized).not.toContain("secret-cookie-value");
    expect(serialized).not.toContain("SECRET-GUID");
  });

  it("marks a private ESPN league as needing attention with a repair message", async () => {
    const harness = await createLeagueConnectionsHarness(espnRoutes);

    const created = await harness.handle({
      method: "POST",
      path: "/league-connections",
      sessionToken: harness.sessionToken,
      now: syncNow,
      body: { provider: "espn", providerLeagueId: "1", season: "2025" },
    });
    const connection = expectBodyRecord(expectBodyRecord(created.body).connection);

    expect(connection.status).toBe("needs_attention");
    expect(expectString(connection.statusDetail)).toContain("espn_s2");
  });

  it("asks which league to connect before saving anything", async () => {
    const harness = await createLeagueConnectionsHarness(sleeperRoutes);

    const response = await harness.handle({
      method: "POST",
      path: "/league-connections",
      sessionToken: harness.sessionToken,
      body: { provider: "sleeper", season: "2018" },
    });

    expect(response.status).toBe(400);
    expect(expectBodyRecord(response.body)).toMatchObject({ error: { code: "league_required" } });
  });

  it("re-syncs on demand and reports an outage without losing the connection", async () => {
    const harness = await createLeagueConnectionsHarness(sleeperOutageRoutes);

    const created = await connectSleeperLeague(harness.handle, harness.sessionToken, syncNow);
    const resynced = await harness.handle({
      method: "POST",
      path: `/league-connections/${connectionIdFrom(created.body)}/sync`,
      sessionToken: harness.sessionToken,
      now: syncNow,
    });

    expect(resynced.status).toBe(200);
    expect(expectBodyRecord(expectBodyRecord(resynced.body).connection))
      .toMatchObject({ status: "error" });
  });

  it("removes a connection and stops serving it", async () => {
    const harness = await createLeagueConnectionsHarness(sleeperRoutes);

    const created = await connectSleeperLeague(harness.handle, harness.sessionToken, syncNow);
    const connectionId = connectionIdFrom(created.body);
    const removed = await harness.handle({
      method: "DELETE",
      path: `/league-connections/${connectionId}`,
      sessionToken: harness.sessionToken,
    });
    const afterDelete = await harness.handle({
      method: "GET",
      path: `/league-connections/${connectionId}`,
      sessionToken: harness.sessionToken,
    });

    expect(removed.status).toBe(200);
    expect(afterDelete.status).toBe(404);
  });

  it("refuses to sync or delete another account's connection", async () => {
    const harness = await createLeagueConnectionsHarness(sleeperRoutes);
    const created = await connectSleeperLeague(harness.handle, harness.sessionToken, syncNow);
    const connectionId = connectionIdFrom(created.body);

    const synced = await harness.handle({
      method: "POST",
      path: `/league-connections/${connectionId}/sync`,
      sessionToken: harness.otherSessionToken,
      now: syncNow,
    });
    const removed = await harness.handle({
      method: "DELETE",
      path: `/league-connections/${connectionId}`,
      sessionToken: harness.otherSessionToken,
    });

    expect(synced.status).toBe(404);
    expect(removed.status).toBe(404);
  });

  it("rejects a method the connection routes do not support", async () => {
    const harness = await createLeagueConnectionsHarness(sleeperRoutes);
    const created = await connectSleeperLeague(harness.handle, harness.sessionToken, syncNow);
    const connectionId = connectionIdFrom(created.body);

    const patched = await harness.handle({
      method: "PATCH",
      path: `/league-connections/${connectionId}`,
      sessionToken: harness.sessionToken,
    });
    const discovered = await harness.handle({
      method: "GET",
      path: "/league-connections/discover",
      sessionToken: harness.sessionToken,
    });

    expect(patched.status).toBe(405);
    expect(discovered.status).toBe(405);
  });
});
