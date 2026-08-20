import { AsyncHistoricalImportRepository, buildCurrentMockdLeagueSeason, deferred, expect, it, jsonFetch, leagueConfig, now, ownerOrder, requestBeforeSendingBody } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer }) => {
  it("rate limits historical previews by account and client before reading upload bodies", async () => {
    const accountKeys: string[] = [];
    const clientKeys: string[] = [];
    const historicalImports = new AsyncHistoricalImportRepository();
    const { platformServer, baseUrl } = await createListeningServer({
      historicalImportRepository: historicalImports,
      historicalImportAccountRateLimiter: {
        consume: key => {
          accountKeys.push(key);
          return { allowed: true, remainingAttempts: 4, retryAfterMs: 0 };
        },
        reset: () => undefined,
      },
      historicalImportClientRateLimiter: {
        consume: key => {
          clientKeys.push(key);
          return { allowed: false, remainingAttempts: 0, retryAfterMs: 30_000 };
        },
        reset: () => undefined,
      },
    });
    const owner = await platformServer.app.createAccount({
      email: "historical-import-limited@example.com",
      password: "secure password1!",
      now,
    });
    const login = await platformServer.app.login({
      email: owner.email,
      password: "secure password1!",
      now,
    });
    if (login === null) throw new Error("Expected historical import fixture login.");
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
      `/seasons/${season.id}/historical-imports/upload-preview`,
      login.sessionToken,
    );
    limited.request.destroy();

    expect(limited.response).toMatchObject({
      status: 429,
      retryAfter: "30",
      body: { error: { code: "rate_limited" } },
    });
    expect(accountKeys).toEqual([owner.id]);
    expect(clientKeys).toEqual(["127.0.0.1"]);
    expect(historicalImports.inner.batches()).toEqual([]);
  });

  it("bounds concurrent historical previews and releases admission for later files", async () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const createEntered = deferred();
    const releaseCreate = deferred();
    const historicalImports = new AsyncHistoricalImportRepository([season], {
      entered: createEntered.resolve,
      release: releaseCreate.promise,
    });
    const { platformServer, baseUrl } = await createListeningServer({
      historicalImportRepository: historicalImports,
      historicalImportMaxConcurrentPerAccount: 1,
      historicalImportMaxConcurrentPerClient: 2,
    });
    const owner = await platformServer.app.createAccount({
      email: "historical-import-concurrent@example.com",
      password: "secure password1!",
      now,
    });
    const login = await platformServer.app.login({
      email: owner.email,
      password: "secure password1!",
      now,
    });
    if (login === null) throw new Error("Expected historical import fixture login.");
    await platformServer.app.registerLeagueSeason({
      actorSessionToken: login.sessionToken,
      season,
      memberships: [{ userId: owner.id, leagueId: season.leagueId, role: "owner" }],
      now,
    });
    const path = `/seasons/${season.id}/historical-imports/upload-preview`;
    const uploadBody = (player: string): string => JSON.stringify({
      fileName: `${player}.csv`,
      mimeType: "text/csv",
      base64: Buffer.from(
        `owner,player,position,price,year\nCam,${player},RB,1,2025`,
      ).toString("base64"),
      seasonYear: 2025,
    });
    const firstImport = jsonFetch(baseUrl, path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": login.sessionToken,
      },
      body: uploadBody("Player One"),
    });
    await createEntered.promise;

    const concurrent = await requestBeforeSendingBody(baseUrl, path, login.sessionToken);
    concurrent.request.destroy();
    expect(concurrent.response).toMatchObject({
      status: 429,
      retryAfter: "1",
      body: { error: { code: "historical_import_busy" } },
    });
    expect(historicalImports.inner.batches()).toEqual([]);

    releaseCreate.resolve();
    await expect(firstImport).resolves.toMatchObject({ status: 200 });
    await expect(jsonFetch(baseUrl, path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": login.sessionToken,
      },
      body: uploadBody("Player Two"),
    })).resolves.toMatchObject({ status: 200 });
    expect(historicalImports.inner.batches()).toHaveLength(2);
  });
});
