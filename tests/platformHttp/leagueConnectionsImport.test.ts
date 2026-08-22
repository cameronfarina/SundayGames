import { createLeagueConnectionsHarness } from "./leagueConnections/harness.js";
import {
  changeableEspnSnakeImportRoutes,
  connectEspnSnakeLeague,
  connectImportableLeague,
  importLeague,
  importableRoutes,
  unsupportedSlotRoutes,
} from "./leagueConnections/importFixtures.js";
import { connectSleeperLeague, connectionIdFrom, sleeperOutageRoutes } from "./leagueConnections/routes.js";
import { syncNow } from "./leagueConnections/harness.js";
import type { RegisterLeagueSeasonRepositoryInput } from "../../src/platform/leagueSetup.js";
import {
  describe,
  expect,
  expectBodyRecord,
  expectRecordArray,
  expectString,
  it,
  InMemoryPlatformStore,
} from "./support/index.js";

class CapabilityAdvertisingLeagueSetupRepository extends InMemoryPlatformStore {
  registerLeagueSeasonWithConnection(
    input: RegisterLeagueSeasonRepositoryInput,
    _leagueConnectionId: string,
  ) {
    return this.registerLeagueSeason(input);
  }
}

describe("league connection import HTTP", () => {
  it("creates an ESPN snake league in ESPN's published pick order", async () => {
    const provider = changeableEspnSnakeImportRoutes();
    const harness = await createLeagueConnectionsHarness(provider.routes);
    const connectionId = await connectEspnSnakeLeague(harness.handle, harness.sessionToken);

    const response = await importLeague(harness.handle, harness.sessionToken, connectionId);
    const imported = expectBodyRecord(expectBodyRecord(response.body).imported);
    const seasonResponse = await harness.handle({
      method: "GET",
      path: `/seasons/${expectString(imported.seasonId)}`,
      sessionToken: harness.sessionToken,
    });
    const teams = expectRecordArray(expectBodyRecord(expectBodyRecord(seasonResponse.body).season).teams);

    expect(response.status).toBe(200);
    expect(teams.map(team => [team.displayName, team.draftOrderPosition])).toEqual([
      ["ESPN Team 3", 1],
      ["ESPN Team 1", 2],
      ["ESPN Team 4", 3],
      ["ESPN Team 2", 4],
    ]);
  });

  it("keeps ESPN's pick order when an offline draft needs a manual snake choice", async () => {
    const provider = changeableEspnSnakeImportRoutes();
    provider.setDraftType("OFFLINE");
    const harness = await createLeagueConnectionsHarness(provider.routes);
    const connectionId = await connectEspnSnakeLeague(harness.handle, harness.sessionToken);

    const response = await importLeague(harness.handle, harness.sessionToken, connectionId, {
      mode: "create",
      draft: { type: "snake", rounds: 8 },
    });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const imported = expectBodyRecord(expectBodyRecord(response.body).imported);
    const seasonResponse = await harness.handle({
      method: "GET",
      path: `/seasons/${expectString(imported.seasonId)}`,
      sessionToken: harness.sessionToken,
    });
    const teams = expectRecordArray(expectBodyRecord(expectBodyRecord(seasonResponse.body).season).teams);

    expect(teams.map(team => team.displayName)).toEqual([
      "ESPN Team 3",
      "ESPN Team 1",
      "ESPN Team 4",
      "ESPN Team 2",
    ]);
  });

  it("still accepts a manual auction choice for an offline ESPN draft", async () => {
    const provider = changeableEspnSnakeImportRoutes();
    provider.setDraftType("OFFLINE");
    const harness = await createLeagueConnectionsHarness(provider.routes);
    const connectionId = await connectEspnSnakeLeague(harness.handle, harness.sessionToken);

    const response = await importLeague(harness.handle, harness.sessionToken, connectionId, {
      mode: "create",
      draft: { type: "auction", budgetDollars: 200, minimumBidDollars: 1 },
    });

    expect(response.status).toBe(200);
  });

  it("turns a synced connection into a real Sunday Games league", async () => {
    const harness = await createLeagueConnectionsHarness(importableRoutes);
    const connectionId = await connectImportableLeague(harness.handle, harness.sessionToken);

    const response = await importLeague(harness.handle, harness.sessionToken, connectionId);
    const body = expectBodyRecord(response.body);
    const imported = expectBodyRecord(body.imported);

    expect(response.status).toBe(200);
    expect(imported.leagueName).toBe("Sleeper Friends League");
    expect(imported.leagueSlug).toBe("sleeper-friends-league");
    // The connection now points at the league, so the card can link to it.
    expect(expectBodyRecord(body.connection)).toMatchObject({
      importedSeasonId: imported.seasonId,
      importedLeagueSlug: "sleeper-friends-league",
      importedLeagueName: "Sleeper Friends League",
    });

    const season = await harness.handle({
      method: "GET",
      path: `/seasons/${expectString(imported.seasonId)}`,
      sessionToken: harness.sessionToken,
    });
    expect(expectBodyRecord(expectBodyRecord(season.body).season)).toMatchObject({
      seasonYear: 2018,
      setupStatus: "draft",
    });
  });

  it("returns the league it already made instead of a second copy", async () => {
    const harness = await createLeagueConnectionsHarness(importableRoutes);
    const connectionId = await connectImportableLeague(harness.handle, harness.sessionToken);

    const first = await importLeague(harness.handle, harness.sessionToken, connectionId);
    const second = await importLeague(harness.handle, harness.sessionToken, connectionId);

    expect(second.status).toBe(200);
    expect(expectBodyRecord(second.body).imported)
      .toEqual(expectBodyRecord(first.body).imported);
    const onboarding = await harness.handle({
      method: "GET",
      path: "/onboarding",
      sessionToken: harness.sessionToken,
    });
    expect(expectRecordArray(expectBodyRecord(onboarding.body).leagues)).toHaveLength(1);
  });

  it("uses fallback linking when only the HTTP services repository advertises atomic imports", async () => {
    const harness = await createLeagueConnectionsHarness(importableRoutes, {
      httpLeagueSetupRepository: new CapabilityAdvertisingLeagueSetupRepository(),
    });
    const connectionId = await connectImportableLeague(harness.handle, harness.sessionToken);

    const response = await importLeague(harness.handle, harness.sessionToken, connectionId);
    const account = await harness.app.findAccountBySessionToken(harness.sessionToken);
    if (account === null) throw new Error("Expected the import owner account.");
    const savedConnection = await harness.repository.findConnection(
      account.id,
      connectionId,
    );

    expect(response.status).toBe(200);
    expect(savedConnection?.leagueSeasonId).toBe(
      expectString(expectBodyRecord(expectBodyRecord(response.body).imported).seasonId),
    );
  });

  it("asks the owner to sync before there is anything to import", async () => {
    const harness = await createLeagueConnectionsHarness(sleeperOutageRoutes);
    const created = await connectSleeperLeague(harness.handle, harness.sessionToken, syncNow);
    const connectionId = connectionIdFrom(created.body);

    const response = await importLeague(harness.handle, harness.sessionToken, connectionId);

    expect(response.status).toBe(409);
    expect(expectBodyRecord(response.body)).toMatchObject({
      error: { code: "snapshot_required", message: "Sync this league before importing it." },
    });
  });

  it("names the provider settings the owner has to sort out first", async () => {
    const harness = await createLeagueConnectionsHarness(unsupportedSlotRoutes);
    const connectionId = await connectImportableLeague(harness.handle, harness.sessionToken);

    const response = await importLeague(harness.handle, harness.sessionToken, connectionId);
    const error = expectBodyRecord(expectBodyRecord(response.body).error);

    expect(response.status).toBe(422);
    expect(error.code).toBe("import_needs_review");
    // The issues ride inside the error, where a caller already looks on failure.
    expect(error.issues).toEqual(["Sleeper roster slot IDP_FLEX is not supported."]);
  });

  it("re-syncs a snapshot stored before draft settings rode along", async () => {
    const harness = await createLeagueConnectionsHarness(importableRoutes);
    const connectionId = await connectImportableLeague(harness.handle, harness.sessionToken);
    const stored = await harness.repository.findSnapshot(connectionId);
    if (stored === null) throw new Error("expected a stored snapshot");
    // A snapshot synced before draft settings existed has no draft type; the
    // import should fetch a fresh one instead of asking the owner to intervene.
    await harness.repository.saveSnapshot(connectionId, {
      settings: {
        name: stored.settings.name,
        season: stored.settings.season,
        teamCount: stored.settings.teamCount,
        rosterPositions: stored.settings.rosterPositions,
        scoring: stored.settings.scoring,
      },
      teams: stored.teams,
      matchups: stored.matchups,
    }, stored.syncedAt, stored.syncRevision);

    const response = await importLeague(harness.handle, harness.sessionToken, connectionId);
    const body = expectBodyRecord(response.body);

    expect(response.status).toBe(200);
    expect(expectBodyRecord(body.imported).leagueName).toBe("Sleeper Friends League");
  });

  it("lets the owner supply draft settings the provider did not return", async () => {
    const routesWithoutDraft = importableRoutes.filter(route => route.match !== "/drafts");
    const harness = await createLeagueConnectionsHarness(routesWithoutDraft);
    const connectionId = await connectImportableLeague(harness.handle, harness.sessionToken);

    const blocked = await importLeague(harness.handle, harness.sessionToken, connectionId);
    expect(blocked.status).toBe(422);
    expect(expectBodyRecord(expectBodyRecord(blocked.body).error)).toMatchObject({
      code: "import_needs_review",
      draftSetup: {
        auctionBudgetDollars: 200,
        minimumBidDollars: 1,
        snakeRounds: 9,
      },
    });

    const imported = await importLeague(harness.handle, harness.sessionToken, connectionId, {
      mode: "create",
      draft: { type: "snake", rounds: 9 },
    });

    expect(imported.status).toBe(200);
  });

  it("keeps one account's connections out of another account's reach", async () => {
    const harness = await createLeagueConnectionsHarness(importableRoutes);
    const connectionId = await connectImportableLeague(harness.handle, harness.sessionToken);

    const response = await importLeague(harness.handle, harness.otherSessionToken, connectionId);

    expect(response.status).toBe(404);
    expect(expectBodyRecord(response.body))
      .toMatchObject({ error: { code: "connection_not_found" } });
  });

  it("refuses to replace a league the request never named", async () => {
    const harness = await createLeagueConnectionsHarness(importableRoutes);
    const connectionId = await connectImportableLeague(harness.handle, harness.sessionToken);

    const response = await importLeague(
      harness.handle,
      harness.sessionToken,
      connectionId,
      { mode: "overwrite" },
    );

    expect(response.status).toBe(400);
    expect(expectBodyRecord(response.body))
      .toMatchObject({ error: { code: "invalid_import_mode" } });
  });

  it("says nothing about an imported league that has since gone away", async () => {
    const harness = await createLeagueConnectionsHarness(importableRoutes);
    const connectionId = await connectImportableLeague(harness.handle, harness.sessionToken);
    await harness.repository.linkConnectionToSeason(connectionId, "season-that-was-deleted");

    const response = await harness.handle({
      method: "GET",
      path: "/league-connections",
      sessionToken: harness.sessionToken,
    });
    const [connection] = expectRecordArray(expectBodyRecord(response.body).connections);

    expect(connection).toBeDefined();
    expect(connection?.importedSeasonId).toBeUndefined();
    expect(connection?.importedLeagueSlug).toBeUndefined();
    expect(connection?.importedLeagueName).toBeUndefined();
  });

  it("requires a signed-in account", async () => {
    const harness = await createLeagueConnectionsHarness(importableRoutes);
    const connectionId = await connectImportableLeague(harness.handle, harness.sessionToken);

    const response = await harness.handle({
      method: "POST",
      path: `/league-connections/${connectionId}/import`,
      body: { mode: "create" },
    });

    expect(response.status).toBe(401);
  });
});
