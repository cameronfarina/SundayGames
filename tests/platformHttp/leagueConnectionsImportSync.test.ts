import { createLeagueConnectionsHarness } from "./leagueConnections/harness.js";
import {
  changeableImportableRoutes,
  connectImportableLeague,
  importLeague,
  syncConnection,
} from "./leagueConnections/importFixtures.js";
import {
  describe,
  expect,
  expectBodyRecord,
  expectRecordArray,
  expectString,
  it,
  type PlatformHttpHandler,
} from "./support/index.js";

const seasonRecord = async (
  handle: PlatformHttpHandler,
  sessionToken: string,
  seasonId: string,
) => {
  const response = await handle({
    method: "GET",
    path: `/seasons/${seasonId}`,
    sessionToken,
  });
  return expectBodyRecord(expectBodyRecord(response.body).season);
};

describe("imported league re-sync HTTP", () => {
  it("carries a renamed provider league through to the league it created", async () => {
    const provider = changeableImportableRoutes();
    const harness = await createLeagueConnectionsHarness(provider.routes);
    const connectionId = await connectImportableLeague(harness.handle, harness.sessionToken);
    const imported = await importLeague(harness.handle, harness.sessionToken, connectionId);
    const seasonId = expectString(
      expectBodyRecord(expectBodyRecord(imported.body).imported).seasonId,
    );

    provider.renameLeague("Sunday Beatdown");
    const synced = await syncConnection(harness.handle, harness.sessionToken, connectionId);
    const season = await seasonRecord(harness.handle, harness.sessionToken, seasonId);

    expect(expectBodyRecord(expectBodyRecord(synced.body).connection).status).toBe("ok");
    expect(expectBodyRecord(season.league).name).toBe("Sunday Beatdown");
    // The season it produced is still the one the connection points at.
    expect(expectBodyRecord(expectBodyRecord(synced.body).connection).importedSeasonId)
      .toBe(seasonId);
  });

  it("asks the owner about a team the provider dropped instead of deleting it", async () => {
    const provider = changeableImportableRoutes();
    const harness = await createLeagueConnectionsHarness(provider.routes);
    const connectionId = await connectImportableLeague(harness.handle, harness.sessionToken);
    const imported = await importLeague(harness.handle, harness.sessionToken, connectionId);
    const seasonId = expectString(
      expectBodyRecord(expectBodyRecord(imported.body).imported).seasonId,
    );

    provider.dropOneTeam();
    const synced = await syncConnection(harness.handle, harness.sessionToken, connectionId);
    const connection = expectBodyRecord(expectBodyRecord(synced.body).connection);
    const season = await seasonRecord(harness.handle, harness.sessionToken, seasonId);

    expect(connection.status).toBe("needs_attention");
    expect(connection.statusDetail).toBe(
      "This league now has 3 teams at the provider and 4 in Sunday Games. " +
      "Fix the teams in the league settings, then sync again.",
    );
    // Everything keyed to a team id survives, because no team was removed.
    expect(expectRecordArray(season.teams)).toHaveLength(4);
  });

  it("leaves an unimported connection's sync exactly as it was", async () => {
    const provider = changeableImportableRoutes();
    const harness = await createLeagueConnectionsHarness(provider.routes);
    const connectionId = await connectImportableLeague(harness.handle, harness.sessionToken);

    provider.renameLeague("Sunday Beatdown");
    const synced = await syncConnection(harness.handle, harness.sessionToken, connectionId);
    const connection = expectBodyRecord(expectBodyRecord(synced.body).connection);

    expect(connection.status).toBe("ok");
    expect(connection.displayName).toBe("Sunday Beatdown");
    expect(connection.importedSeasonId).toBeUndefined();
  });
});
