import {
  createLeagueConnectionsHarness,
  syncNow,
  type LeagueConnectionsHarness,
} from "./leagueConnections/harness.js";
import { connectionIdFrom, espnRoutes } from "./leagueConnections/routes.js";
import { describe, expect, it } from "./support/index.js";

const connectPrivateEspn = async (harness: LeagueConnectionsHarness) =>
  await harness.handle({
    method: "POST",
    path: "/league-connections",
    sessionToken: harness.sessionToken,
    now: syncNow,
    body: {
      provider: "espn",
      providerLeagueId: "899513",
      season: "2025",
      credentialMode: "private",
      espnS2: "saved-s2",
      swid: "{SAVED}",
    },
  });

describe("league connection credential HTTP boundaries", () => {
  it("keeps ESPN cookies out of every response after they are saved", async () => {
    const harness = await createLeagueConnectionsHarness(espnRoutes);
    const created = await connectPrivateEspn(harness);
    const listed = await harness.handle({
      method: "GET",
      path: "/league-connections",
      sessionToken: harness.sessionToken,
    });

    const serialized = JSON.stringify([created.body, listed.body]);
    expect(serialized).not.toContain("saved-s2");
    expect(serialized).not.toContain("SAVED");
  });

  it("deletes saved ESPN credentials before a public reconnect syncs", async () => {
    const harness = await createLeagueConnectionsHarness(espnRoutes);
    const connectionId = connectionIdFrom((await connectPrivateEspn(harness)).body);
    expect(await harness.repository.findCredentials(connectionId)).not.toBeNull();

    const reconnected = await harness.handle({
      method: "POST",
      path: "/league-connections",
      sessionToken: harness.sessionToken,
      now: new Date("2026-08-19T12:01:00.000Z"),
      body: {
        provider: "espn",
        providerLeagueId: "899513",
        season: "2025",
        credentialMode: "public",
      },
    });

    expect(reconnected.status).toBe(201);
    expect(await harness.repository.findCredentials(connectionId)).toBeNull();
  });

  it("rejects malformed explicit modes without syncing or clearing", async () => {
    const harness = await createLeagueConnectionsHarness(espnRoutes);
    const connectionId = connectionIdFrom((await connectPrivateEspn(harness)).body);
    harness.requests.splice(0);

    for (const credentialMode of [42, ""]) {
      const response = await harness.handle({
        method: "POST",
        path: "/league-connections",
        sessionToken: harness.sessionToken,
        body: { provider: "espn", providerLeagueId: "899513", season: "2025", credentialMode },
      });
      expect(response.status).toBe(400);
    }

    expect(harness.requests).toEqual([]);
    expect(await harness.repository.findCredentials(connectionId))
      .toEqual({ espnS2: "saved-s2", swid: "{SAVED}" });
  });

  it("retains saved ESPN credentials for a legacy reconnect with no mode", async () => {
    const harness = await createLeagueConnectionsHarness(espnRoutes);
    const connectionId = connectionIdFrom((await connectPrivateEspn(harness)).body);
    const response = await harness.handle({
      method: "POST",
      path: "/league-connections",
      sessionToken: harness.sessionToken,
      now: new Date("2026-08-19T12:01:00.000Z"),
      body: { provider: "espn", providerLeagueId: "899513", season: "2025" },
    });

    expect(response.status).toBe(201);
    expect(await harness.repository.findCredentials(connectionId))
      .toEqual({ espnS2: "saved-s2", swid: "{SAVED}" });
  });
});
