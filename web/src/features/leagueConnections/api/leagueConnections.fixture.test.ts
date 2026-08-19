import { describe, expect, it } from "vitest";
import {
  connectionListFixture,
  discoveredLeaguesFixture,
  providerCatalogFixture,
} from "./leagueConnections.fixture";
import { connectionDetailFixture } from "./leagueDetail.fixture";

describe("league connection fixtures", () => {
  it("covers a healthy connection, one needing attention, and every provider", () => {
    expect(connectionListFixture.connections.map(connection => connection.status))
      .toEqual(["ok", "needs_attention"]);
    expect(providerCatalogFixture.map(provider => provider.provider))
      .toEqual(["sleeper", "espn", "yahoo"]);
    expect(discoveredLeaguesFixture.leagues).toHaveLength(2);
    expect(connectionDetailFixture.league?.matchups).toHaveLength(2);
  });
});
