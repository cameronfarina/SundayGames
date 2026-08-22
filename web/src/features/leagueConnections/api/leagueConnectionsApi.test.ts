import { describe, expect, it, vi } from "vitest";
import {
  connectionListFixture,
  discoveredLeaguesFixture,
  leagueImportFixture,
  syncedConnectionFixture,
} from "./leagueConnections.fixture";
import { connectionDetailFixture } from "./leagueDetail.fixture";
import {
  connectLeague,
  discoverLeagues,
  getLeagueConnectionDetail,
  getLeagueConnections,
  importLeagueConnection,
  removeLeagueConnection,
  syncLeagueConnection,
} from "./leagueConnectionsApi";

const stubFetch = (body: unknown) => {
  const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body))));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
};

describe("league connections API", () => {
  it("lists connections and providers in one request", async () => {
    const fetcher = stubFetch(connectionListFixture);

    const result = await getLeagueConnections();

    expect(result.connections).toHaveLength(2);
    expect(result.providers).toHaveLength(3);
    expect(fetcher).toHaveBeenCalledWith(
      "/league-connections",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("passes an abort signal through to the browser", async () => {
    const fetcher = stubFetch(connectionListFixture);
    const signal = new AbortController().signal;

    await getLeagueConnections(signal);

    expect(fetcher).toHaveBeenCalledWith("/league-connections", expect.objectContaining({ signal }));
  });

  it("encodes a connection id into the detail path", async () => {
    const fetcher = stubFetch(connectionDetailFixture);

    const result = await getLeagueConnectionDetail("connection sleeper");

    expect(result.league?.teams).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledWith(
      "/league-connections/connection%20sleeper",
      expect.anything(),
    );
  });

  it("requests a league detail with an abort signal when one is given", async () => {
    const fetcher = stubFetch(connectionDetailFixture);
    const signal = new AbortController().signal;

    await getLeagueConnectionDetail("connection-sleeper", signal);

    expect(fetcher).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ signal }));
  });

  it("sends the provider, handle, and season when looking for leagues", async () => {
    const fetcher = stubFetch(discoveredLeaguesFixture);

    const result = await discoverLeagues({
      provider: "sleeper",
      handle: "feiyingx",
      season: "2026",
    });

    expect(result.leagues).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledWith(
      "/league-connections/discover",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ provider: "sleeper", handle: "feiyingx", season: "2026" }),
      }),
    );
  });

  it("asks for a brand new league and reads back the one it built", async () => {
    const fetcher = stubFetch(leagueImportFixture);

    const result = await importLeagueConnection({
      connectionId: "connection sleeper",
      request: { mode: "create" },
    });

    expect(result.imported.leagueSlug).toBe("sleeper-friends-league");
    expect(fetcher).toHaveBeenCalledWith(
      "/league-connections/connection%20sleeper/import",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ mode: "create" }) }),
    );
  });

  it("names the season a replacement import overwrites", async () => {
    const fetcher = stubFetch(leagueImportFixture);

    await importLeagueConnection({
      connectionId: "connection-sleeper",
      request: { mode: "overwrite", seasonId: "season-9" },
    });

    expect(fetcher).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      body: JSON.stringify({ mode: "overwrite", seasonId: "season-9" }),
    }));
  });

  it("sends owner-supplied draft settings when ESPN omits them", async () => {
    const fetcher = stubFetch(leagueImportFixture);

    await importLeagueConnection({
      connectionId: "connection-espn",
      request: {
        mode: "create",
        draft: { type: "auction", budgetDollars: 200, minimumBidDollars: 1 },
      },
    });

    expect(fetcher).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      body: JSON.stringify({
        mode: "create",
        draft: { type: "auction", budgetDollars: 200, minimumBidDollars: 1 },
      }),
    }));
  });

  it("creates a connection, syncs it, and removes it", async () => {
    const fetcher = stubFetch({ connection: syncedConnectionFixture });
    await connectLeague({
      provider: "espn",
      providerLeagueId: "899513",
      displayName: "Pigskin Power Bottoms",
      season: "2026",
      espnS2: "s2-value",
      swid: "{GUID}",
    });
    await syncLeagueConnection("connection-espn");
    stubFetch({ removed: true });
    const removal = await removeLeagueConnection("connection-espn");

    expect(removal.removed).toBe(true);
    expect(fetcher).toHaveBeenNthCalledWith(1, "/league-connections", expect.objectContaining({
      method: "POST",
    }));
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "/league-connections/connection-espn/sync",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
