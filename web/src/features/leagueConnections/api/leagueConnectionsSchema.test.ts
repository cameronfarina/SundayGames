import { describe, expect, it } from "vitest";
import {
  connectionListFixture,
  discoveredLeaguesFixture,
  leagueImportFixture,
} from "./leagueConnections.fixture";
import { connectionDetailFixture } from "./leagueDetail.fixture";
import {
  discoveredLeaguesSchema,
  importReviewSchema,
  leagueConnectionDetailSchema,
  leagueConnectionListSchema,
  leagueImportSchema,
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

  it("reads the league an import produced", () => {
    const parsed = leagueImportSchema.parse(leagueImportFixture);

    expect(parsed.imported.leagueSlug).toBe("sleeper-friends-league");
    expect(parsed.connection.importedSeasonId).toBe("season-imported");
  });

  it("keeps the draft settings a synced league now carries", () => {
    const settings = leagueConnectionDetailSchema.parse(connectionDetailFixture).league?.settings;

    expect(settings?.draftType).toBe("auction");
    expect(settings?.auctionBudget).toBe(200);
    expect(settings?.keeperCount).toBe(2);
  });

  it("reads the reasons out of a refused import", () => {
    expect(importReviewSchema.parse({ error: { issues: ["Slot HC is not supported."] } })
      .error.issues).toEqual(["Slot HC is not supported."]);
    expect(importReviewSchema.safeParse({ error: { code: "boom" } }).success).toBe(false);
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
