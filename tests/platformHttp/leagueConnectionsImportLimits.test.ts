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
  expectString,
  it,
  vi,
  type PlatformHttpHandler,
} from "./support/index.js";

const manualLeagueSetup = (externalLeagueId: string) => ({
  provider: "mockd",
  externalLeagueId,
  leagueName: `Hand-Made ${externalLeagueId}`,
  seasonYear: 2026,
  expectedTeamCount: 4,
  teams: [
    { externalTeamId: "a", displayName: "Short King" },
    { externalTeamId: "b", displayName: "Dart Vader" },
    { externalTeamId: "c", displayName: "Old Dogs" },
    { externalTeamId: "d", displayName: "Peace Bridge" },
  ],
  draft: { type: "snake", rounds: 9, order: ["a", "b", "c", "d"] },
  scoring: { ...defaultScoringSettings },
  rosterSlots: { QB: 1, RB: 2, WR: 1, FLEX: 1, DST: 1, K: 1, BENCH: 2 },
});

const createManualLeague = async (
  handle: PlatformHttpHandler,
  sessionToken: string,
  externalLeagueId: string,
) => await handle({
  method: "POST",
  path: "/leagues",
  sessionToken,
  body: { setup: manualLeagueSetup(externalLeagueId) },
});

describe("imported league creation limits", () => {
  it("imports a league even when the hourly creation window is full", async () => {
    const harness = await createLeagueConnectionsHarness(importableRoutes, {
      leagueCreationLimits: {
        maxActiveLeaguesPerAccount: 20,
        maxCreatedLeaguesPerWindow: 1,
        creationWindowMs: 60 * 60 * 1_000,
      },
    });
    const connectionId = await connectImportableLeague(harness.handle, harness.sessionToken);

    await expect(createManualLeague(harness.handle, harness.sessionToken, "100001"))
      .resolves.toMatchObject({ status: 201 });
    // Making a second league by hand is what the window is there to stop.
    await expect(createManualLeague(harness.handle, harness.sessionToken, "100002"))
      .resolves.toMatchObject({ status: 429, body: { error: { code: "league_creation_rate_limited" } } });

    const imported = await importLeague(harness.handle, harness.sessionToken, connectionId);

    expect(imported.status).toBe(200);
  });

  it("still holds an import to the account's active league limit", async () => {
    const harness = await createLeagueConnectionsHarness(importableRoutes, {
      leagueCreationLimits: {
        maxActiveLeaguesPerAccount: 1,
        maxCreatedLeaguesPerWindow: 20,
        creationWindowMs: 60 * 60 * 1_000,
      },
    });
    const connectionId = await connectImportableLeague(harness.handle, harness.sessionToken);
    await createManualLeague(harness.handle, harness.sessionToken, "100001");

    const imported = await importLeague(harness.handle, harness.sessionToken, connectionId);

    expect(imported.status).toBe(409);
    expect(expectBodyRecord(imported.body))
      .toMatchObject({ error: { code: "active_league_quota_reached" } });
  });

  it("refuses to replace a league whose draft room is already open", async () => {
    const harness = await createLeagueConnectionsHarness(importableRoutes);
    const connectionId = await connectImportableLeague(harness.handle, harness.sessionToken);
    const created = await createManualLeague(harness.handle, harness.sessionToken, "100001");
    const season = expectBodyRecord(expectBodyRecord(created.body).season);
    harness.app.hasLiveDraftRoomForSeason = vi.fn(async () => true);

    const response = await importLeague(harness.handle, harness.sessionToken, connectionId, {
      mode: "overwrite",
      seasonId: expectString(season.id),
    });

    expect(response.status).toBe(409);
    expect(expectBodyRecord(response.body))
      .toMatchObject({ error: { code: "league_setup_locked" } });
  });
});
