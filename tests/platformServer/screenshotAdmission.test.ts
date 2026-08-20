import { buildCurrentMockdLeagueSeason, expect, it, leagueConfig, now, ownerOrder, requestBeforeSendingBody } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer }) => {
  it("rejects unauthenticated and unauthorized screenshot uploads before reading their bodies", async () => {
    let analysisCallCount = 0;
    const { platformServer, baseUrl } = await createListeningServer({
      leagueMembersScreenshotAnalyzer: {
        analyze: async () => {
          analysisCallCount += 1;
          throw new Error("The analyzer must not run for a rejected upload.");
        },
      },
    });
    const owner = await platformServer.app.createAccount({
      email: "screenshot-owner@example.com",
      password: "secure password1!",
      now,
    });
    const member = await platformServer.app.createAccount({
      email: "screenshot-member@example.com",
      password: "secure password1!",
      now,
    });
    const ownerLogin = await platformServer.app.login({
      email: owner.email,
      password: "secure password1!",
      now,
    });
    const memberLogin = await platformServer.app.login({
      email: member.email,
      password: "secure password1!",
      now,
    });
    if (ownerLogin === null || memberLogin === null) throw new Error("Expected fixture logins.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    await platformServer.app.registerLeagueSeason({
      actorSessionToken: ownerLogin.sessionToken,
      season,
      memberships: [
        { userId: owner.id, leagueId: season.leagueId, role: "owner" },
        { userId: member.id, leagueId: season.leagueId, role: "member" },
      ],
      now,
    });
    const path = `/seasons/${season.id}/setup-import/screenshot-analyze`;

    const unauthenticated = await requestBeforeSendingBody(baseUrl, path);
    unauthenticated.request.destroy();
    expect(unauthenticated.response).toMatchObject({
      status: 401,
      body: { error: { code: "auth_required" } },
    });

    const unauthorized = await requestBeforeSendingBody(
      baseUrl,
      path,
      memberLogin.sessionToken,
    );
    unauthorized.request.destroy();
    expect(unauthorized.response).toMatchObject({
      status: 403,
      body: { error: { code: "shared_mutation_denied" } },
    });
    expect(analysisCallCount).toBe(0);
  });

  it("rate limits authorized screenshot uploads before reading their bodies", async () => {
    let ingressAttempts = 0;
    let analysisCallCount = 0;
    const { platformServer, baseUrl } = await createListeningServer({
      screenshotImportIngressRateLimiter: {
        consume: () => {
          ingressAttempts += 1;
          return { allowed: false, remainingAttempts: 0, retryAfterMs: 30_000 };
        },
        reset: () => undefined,
      },
      leagueMembersScreenshotAnalyzer: {
        analyze: async () => {
          analysisCallCount += 1;
          throw new Error("The analyzer must not run for a rate-limited upload.");
        },
      },
    });
    const owner = await platformServer.app.createAccount({
      email: "screenshot-limited@example.com",
      password: "secure password1!",
      now,
    });
    const login = await platformServer.app.login({
      email: owner.email,
      password: "secure password1!",
      now,
    });
    if (login === null) throw new Error("Expected fixture login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    await platformServer.app.registerLeagueSeason({
      actorSessionToken: login.sessionToken,
      season,
      memberships: [{ userId: owner.id, leagueId: season.leagueId, role: "owner" }],
      now,
    });

    const limited = await requestBeforeSendingBody(
      baseUrl,
      `/seasons/${season.id}/setup-import/screenshot-analyze`,
      login.sessionToken,
    );
    limited.request.destroy();

    expect(limited.response).toMatchObject({
      status: 429,
      body: { error: { code: "rate_limited" } },
    });
    expect(ingressAttempts).toBe(1);
    expect(analysisCallCount).toBe(0);
  });
});
