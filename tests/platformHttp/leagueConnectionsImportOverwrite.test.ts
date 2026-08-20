import { createLeagueConnectionsHarness } from "./leagueConnections/harness.js";
import {
  connectImportableLeague,
  importLeague,
  importableRoutes,
} from "./leagueConnections/importFixtures.js";
import {
  defaultScoringSettings,
  describe,
  expect,
  expectBodyRecord,
  expectRecordArray,
  expectString,
  it,
  type PlatformHttpHandler,
} from "./support/index.js";

const manualLeagueSetup = {
  provider: "mockd",
  externalLeagueId: "100001",
  leagueName: "My Hand-Made League",
  seasonYear: 2026,
  expectedTeamCount: 4,
  teams: [
    { externalTeamId: "a", displayName: "Short King", managerNames: ["Owner 1"] },
    { externalTeamId: "b", displayName: "Dart Vader", managerNames: ["Owner 2"] },
    { externalTeamId: "c", displayName: "Old Dogs", managerNames: ["Owner 3"] },
    { externalTeamId: "d", displayName: "Peace Bridge", managerNames: ["Owner 4"] },
  ],
  draft: { type: "snake", rounds: 9, order: ["a", "b", "c", "d"] },
  scoring: { ...defaultScoringSettings },
  rosterSlots: { QB: 1, RB: 2, WR: 1, FLEX: 1, DST: 1, K: 1, BENCH: 2 },
};

const createManualLeague = async (handle: PlatformHttpHandler, sessionToken: string) => {
  const response = await handle({
    method: "POST",
    path: "/leagues",
    sessionToken,
    body: { setup: manualLeagueSetup },
  });
  return expectBodyRecord(expectBodyRecord(response.body).season);
};

describe("league connection import overwrite HTTP", () => {
  it("replaces a league the owner already manages and keeps its team ids", async () => {
    const harness = await createLeagueConnectionsHarness(importableRoutes);
    const connectionId = await connectImportableLeague(harness.handle, harness.sessionToken);
    const season = await createManualLeague(harness.handle, harness.sessionToken);
    const teamIdsBefore = expectRecordArray(season.teams).map(team => expectString(team.id));

    const response = await importLeague(harness.handle, harness.sessionToken, connectionId, {
      mode: "overwrite",
      seasonId: expectString(season.id),
    });
    const body = expectBodyRecord(response.body);
    const imported = expectBodyRecord(body.imported);

    expect(response.status).toBe(200);
    // The season and the league survive the replacement, so nothing keyed to
    // them is orphaned; only what the provider names is rewritten.
    expect(imported.seasonId).toBe(season.id);
    expect(imported.leagueId).toBe(season.leagueId);
    expect(imported.leagueName).toBe("Sleeper Friends League");
    expect(expectBodyRecord(body.connection).importedLeagueSlug).toBe(imported.leagueSlug);

    const after = await harness.handle({
      method: "GET",
      path: `/seasons/${expectString(season.id)}`,
      sessionToken: harness.sessionToken,
    });
    const updated = expectBodyRecord(expectBodyRecord(after.body).season);
    // Keepers and claimed teams hang off these ids, so they must not be reissued.
    expect(expectRecordArray(updated.teams).map(team => expectString(team.id)))
      .toEqual(teamIdsBefore);
    expect(expectRecordArray(updated.teams).map(team => team.displayName))
      .toEqual(["Team 1", "Team 2", "Team 3", "Team 4"]);
    expect(expectBodyRecord(updated.league).name).toBe("Sleeper Friends League");
  });

  it("does not replace a league that belongs to somebody else", async () => {
    const harness = await createLeagueConnectionsHarness(importableRoutes);
    const connectionId = await connectImportableLeague(harness.handle, harness.sessionToken);
    const season = await createManualLeague(harness.handle, harness.otherSessionToken);

    const response = await importLeague(harness.handle, harness.sessionToken, connectionId, {
      mode: "overwrite",
      seasonId: expectString(season.id),
    });

    expect(response.status).toBe(403);
  });
});
