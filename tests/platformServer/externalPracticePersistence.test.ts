import { InMemoryMockDraftSessionRepository } from "../../src/platform/mockSessions.js";
import { PostgresMockDraftSessionRepository } from "../../src/platform/postgresMockDraftSessions.js";
import { persistedSimulationRun } from "../platformStoreSnapshotFixtures/simulationRun.js";
import {
  InMemoryPracticeShortlistRepository,
  AsyncSimulationRepository,
  FakeTransactionalPostgresClient,
  FakeTransactionalPostgresAuthClient,
  buildCurrentMockdLeagueSeason,
  expect,
  it,
  jsonFetch,
  leagueConfig,
  mkdir,
  now,
  ownerOrder,
  rm,
  stringProperty,
  propertyValue,
} from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer, storePath }) => {
  it("keeps durable mock sessions outside the compatibility snapshot", async () => {
    const dataFilePath = await storePath();
    const mockDraftSessionRepository = new InMemoryMockDraftSessionRepository();
    const { platformServer, baseUrl } = await createListeningServer({
      dataFilePath,
      mockDraftSessionRepository,
    });
    const account = await platformServer.app.createAccount({
      email: "mock-storage@example.com",
      password: "secure password1!",
      now,
    });
    const login = await platformServer.app.login({
      email: account.email,
      password: "secure password1!",
      now,
    });
    if (login === null) throw new Error("Expected mock storage fixture login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      setupStatus: "published",
    });
    const team = season.teams[0];
    if (team === undefined) throw new Error("Expected mock storage fixture team.");
    await platformServer.app.registerLeagueSeason({
      actorSessionToken: login.sessionToken,
      season,
      memberships: [{
        userId: account.id,
        leagueId: season.leagueId,
        role: "owner",
        ownerId: team.ownerId,
        teamId: team.id,
      }],
      now,
    });
    await platformServer.persist();
    await rm(dataFilePath, { force: true });
    await mkdir(dataFilePath);

    const response = await jsonFetch(baseUrl, "/mock-sessions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": login.sessionToken,
      },
      body: JSON.stringify({
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: team.ownerId,
        teamId: team.id,
        draftMode: { format: "auction", mockCount: 1 },
      }),
    });

    expect(response.status).toBe(201);
    const sessionId = stringProperty(propertyValue(response.body, "mockSession"), "id");
    expect(mockDraftSessionRepository.getSession({
      userId: account.id,
      sessionId,
      now,
    })).toMatchObject({
      id: sessionId,
      userId: account.id,
      seasonId: season.id,
    });
  });

  it("favorites normalized season-simulation outcomes without saving the compatibility snapshot", async () => {
    const dataFilePath = await storePath();
    const simulationRepository = new AsyncSimulationRepository();
    const { platformServer, baseUrl } = await createListeningServer({
      dataFilePath,
      simulationRepository,
    });
    const account = await platformServer.app.createAccount({
      email: "favorite-storage@example.com",
      password: "secure password1!",
      now,
    });
    const login = await platformServer.app.login({
      email: account.email,
      password: "secure password1!",
      now,
    });
    if (login === null) throw new Error("Expected favorite storage fixture login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      setupStatus: "published",
    });
    const team = season.teams[0];
    if (team === undefined) throw new Error("Expected favorite storage fixture team.");
    await platformServer.app.registerLeagueSeason({
      actorSessionToken: login.sessionToken,
      season,
      memberships: [{
        userId: account.id,
        leagueId: season.leagueId,
        role: "owner",
        ownerId: team.ownerId,
        teamId: team.id,
      }],
      now,
    });
    const run = persistedSimulationRun();
    run.privacyOwnerUserId = account.id;
    run.request.userId = account.id;
    run.request.privacyOwnerUserId = account.id;
    run.request.leagueId = season.leagueId;
    run.request.seasonId = season.id;
    run.request.ownerId = team.ownerId;
    run.request.teamId = team.id;
    simulationRepository.inner.replaceRuns([run]);
    await platformServer.persist();
    await rm(dataFilePath, { force: true });
    await mkdir(dataFilePath);

    const response = await jsonFetch(
      baseUrl,
      `/season-simulations/${run.id}/runs/1`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-session-token": login.sessionToken,
        },
        body: JSON.stringify({ favorite: true }),
      },
    );

    expect(response.status).toBe(200);
    expect(simulationRepository.inner.find(run.id).result?.favoriteRunNumbers).toEqual([1]);
  });

  it("exposes the existing external practice repositories without compatibility state", async () => {
    const practiceShortlistRepository = new InMemoryPracticeShortlistRepository();
    const simulationRepository = new AsyncSimulationRepository();
    const mockDraftSessionRepository = new InMemoryMockDraftSessionRepository();
    const { platformServer } = await createListeningServer({
      practiceShortlistRepository,
      simulationRepository,
      mockDraftSessionRepository,
    });

    expect(platformServer.practiceShortlistRepository).toBe(practiceShortlistRepository);
    expect(platformServer.simulationRepository).toBe(simulationRepository);
    expect(platformServer.mockDraftSessionRepository).toBe(mockDraftSessionRepository);
    expect(platformServer.store.snapshot()).toMatchObject({
      practiceShortlistItems: [],
      simulationRuns: [],
      mockDraftSessions: [],
    });
  });

  it("uses normalized mock-session persistence with the shared transactional client", async () => {
    const { platformServer } = await createListeningServer({
      postgresClient: new FakeTransactionalPostgresClient(),
    });

    expect(platformServer.mockDraftSessionRepository)
      .toBeInstanceOf(PostgresMockDraftSessionRepository);
  });

  it("retires compatibility persistence before composing normalized-only mock sessions", async () => {
    const postgresClient = new FakeTransactionalPostgresAuthClient();
    const { platformServer } = await createListeningServer({
      postgresClient,
      practicePersistenceMode: "normalized-only",
    });

    expect(platformServer.mockDraftSessionRepository)
      .toBeInstanceOf(PostgresMockDraftSessionRepository);
    expect(platformServer.store.snapshot().mockDraftSessions).toEqual([]);
    expect(postgresClient.statements).toContainEqual(
      expect.stringContaining("UPDATE platform_practice_persistence_control"),
    );
    expect(postgresClient.statements).toContainEqual(
      expect.stringContaining("SELECT snapshot_key, revision, snapshot_json"),
    );
  });
});
