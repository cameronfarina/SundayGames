import { describe, expect, it } from "vitest";
import {
  connectionListFixture,
  discoveredLeaguesFixture,
} from "./leagueConnections.fixture";
import { connectionDetailFixture } from "./leagueDetail.fixture";
import {
  discoveredLeaguesSchema,
  leagueConnectionDetailSchema,
  leagueConnectionListSchema,
} from "./leagueConnectionsSchema";

describe("league connection schemas", () => {
  it("accepts the wire shapes the platform sends", () => {
    expect(leagueConnectionListSchema.parse(connectionListFixture).connections).toHaveLength(2);
    expect(discoveredLeaguesSchema.parse(discoveredLeaguesFixture).leagues).toHaveLength(2);
    expect(leagueConnectionDetailSchema.parse(connectionDetailFixture).league?.teams)
      .toHaveLength(2);
  });

  it("accepts a connection that has never synced a league", () => {
    expect(leagueConnectionDetailSchema.parse({
      connection: connectionListFixture.connections[1],
      league: null,
    }).league).toBeNull();
  });

  it("rejects a provider or status this app cannot render", () => {
    expect(leagueConnectionListSchema.safeParse({
      ...connectionListFixture,
      connections: [{ ...connectionListFixture.connections[0], provider: "nfl-dot-com" }],
    }).success).toBe(false);
    expect(leagueConnectionListSchema.safeParse({
      ...connectionListFixture,
      connections: [{ ...connectionListFixture.connections[0], status: "half-done" }],
    }).success).toBe(false);
  });
});
