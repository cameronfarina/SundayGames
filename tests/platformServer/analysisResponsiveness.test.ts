import { FakePostgresClient, buildCurrentMockdLeagueSeason, deferred, expect, it, leagueConfig, now, ownerOrder, type LeagueMembersScreenshotImportInput } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer }) => {
  it("keeps health checks responsive while screenshot analysis is in flight", async () => {
    const analysisEntered = deferred();
    const releaseAnalysis = deferred();
    const postgresClient = new FakePostgresClient();
    const { platformServer } = await createListeningServer({
      postgresClient,
      leagueMembersScreenshotAnalyzer: {
        analyze: async (): Promise<LeagueMembersScreenshotImportInput> => {
          analysisEntered.resolve();
          await releaseAnalysis.promise;
          return {
            leagueName: "League 100001",
            externalLeagueId: "100001",
            teams: ownerOrder.map((manager, index) => ({
              draftOrderPosition: index + 1,
              abbreviation: manager.slice(0, 4).toUpperCase(),
              teamDisplayName: `${manager} Team`,
              managerDisplayNames: [manager],
              confidence: "high",
              issues: [],
              confirmed: false,
            })),
          };
        },
      },
    });
    const account = await platformServer.app.createAccount({
      email: "screenshot-health@example.com",
      password: "secure password",
      now,
    });
    const login = await platformServer.app.login({
      email: account.email,
      password: "secure password",
      now,
    });
    if (login === null) throw new Error("Expected screenshot health fixture login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    await platformServer.app.registerLeagueSeason({
      actorSessionToken: login.sessionToken,
      season,
      memberships: [{ userId: account.id, leagueId: season.leagueId, role: "owner" }],
      now,
    });

    const analysis = platformServer.handler({
      method: "POST",
      path: `/seasons/${season.id}/setup-import/screenshot-analyze`,
      sessionToken: login.sessionToken,
      body: { mimeType: "image/png", base64: "fixture" },
      now,
    });
    await analysisEntered.promise;

    await expect(Promise.race([
      platformServer.handler({ method: "GET", path: "/healthz", now }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Health check was blocked.")), 100)),
    ])).resolves.toMatchObject({ status: 200 });
    releaseAnalysis.resolve();
    await expect(analysis).resolves.toMatchObject({ status: 200 });
  });

  it("keeps health checks responsive during league-creation screenshot analysis", async () => {
    const analysisEntered = deferred();
    const releaseAnalysis = deferred();
    const { platformServer } = await createListeningServer({
      postgresClient: new FakePostgresClient(),
      leagueMembersScreenshotAnalyzer: {
        analyze: async (): Promise<LeagueMembersScreenshotImportInput> => {
          analysisEntered.resolve();
          await releaseAnalysis.promise;
          return {
            leagueName: "League 100001",
            externalLeagueId: "100001",
            teams: ownerOrder.map((manager, index) => ({
              draftOrderPosition: index + 1,
              abbreviation: manager.slice(0, 4).toUpperCase(),
              teamDisplayName: `${manager} Team`,
              managerDisplayNames: [manager],
              confidence: "high",
              issues: [],
              confirmed: false,
            })),
          };
        },
      },
    });
    const account = await platformServer.app.createAccount({
      email: "league-create-screenshot-health@example.com",
      password: "secure password",
      now,
    });
    const login = await platformServer.app.login({
      email: account.email,
      password: "secure password",
      now,
    });
    if (login === null) throw new Error("Expected league-creation screenshot fixture login.");

    const analysis = platformServer.handler({
      method: "POST",
      path: "/league-imports/espn/members-screenshot-review",
      sessionToken: login.sessionToken,
      body: { mimeType: "image/png", base64: "fixture" },
      now,
    });
    await analysisEntered.promise;

    await expect(Promise.race([
      platformServer.handler({ method: "GET", path: "/healthz", now }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Health check was blocked.")), 100)),
    ])).resolves.toMatchObject({ status: 200 });
    releaseAnalysis.resolve();
    await expect(analysis).resolves.toMatchObject({ status: 200 });
  });
});
