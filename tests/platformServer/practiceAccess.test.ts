import { InMemoryLiveDraftRoomSetupRepository, buildCurrentMockdLeagueSeason, currentLeagueInitialRostersFor, expect, it, join, jsonFetch, leagueConfig, loadCurrentPlayerCatalog, now, ownerOrder, propertyValue, sessionTokenFrom, stringProperty } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer, temporaryDirectory }) => {
  it("serves Practice before league selection and keeps private prep scoped to members", async () => {
    const directory = await temporaryDirectory("mockd-platform-draft-tools-");
    const draftSetupRepository = new InMemoryLiveDraftRoomSetupRepository();
    const appHtml = "<!doctype html><div id=\"root\"></div>";
    const { platformServer, baseUrl } = await createListeningServer({
      appHtml,
      draftToolsSessionDirectory: directory,
      liveDraftRoomSetupRepository: draftSetupRepository,
    });
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });

    const anonymousBoard = await fetch(
      `${baseUrl}/practice?seasonId=${season.id}&strategy=balanced`,
      {
        redirect: "manual",
      },
    );
    expect(anonymousBoard.status).toBe(200);
    expect(await anonymousBoard.text()).toBe(appHtml);

    const prepAccount = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "prep@example.com", password: "secure password1!" }),
    });
    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "prep@example.com", password: "secure password1!" }),
    });
    const sessionToken = sessionTokenFrom(login);
    const accountId = stringProperty(propertyValue(prepAccount.body, "account"), "id");
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");
    await platformServer.app.registerLeagueSeason({
      actorSessionToken: sessionToken,
      season,
      memberships: [{
        userId: accountId,
        leagueId: season.leagueId,
        role: "owner",
        ownerId: camTeam.ownerId,
        teamId: camTeam.id,
      }],
      now,
    });
    await draftSetupRepository.save({
      seasonId: season.id,
      sourceVersion: "platform-server-test",
      playerCatalog: await loadCurrentPlayerCatalog(),
      initialRosters: currentLeagueInitialRostersFor(season),
      updatedAt: now,
    });

    await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "outsider@example.com", password: "secure password1!" }),
    });
    const outsiderLogin = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "outsider@example.com", password: "secure password1!" }),
    });
    const outsiderSessionToken = sessionTokenFrom(outsiderLogin);

    const missingSeason = await fetch(`${baseUrl}/practice`, {
      headers: { "x-session-token": sessionToken },
    });
    expect(missingSeason.status).toBe(200);
    expect(await missingSeason.text()).toBe(appHtml);

    const outsiderBoard = await fetch(`${baseUrl}/practice?seasonId=${season.id}`, {
      headers: { "x-session-token": outsiderSessionToken },
    });
    expect(outsiderBoard.status).toBe(200);
    expect(await outsiderBoard.text()).toBe(appHtml);

    const board = await fetch(`${baseUrl}/practice?seasonId=${season.id}`, {
      headers: { "x-session-token": sessionToken },
    });
    expect(board.status).toBe(200);
    expect(board.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await board.text()).toBe(appHtml);

    const mockState = await jsonFetch(
      baseUrl,
      `/api/mock/state?seasonId=${season.id}&mode=interactive-mock&draftSession=practice-3rb`,
      {
        headers: { "x-session-token": sessionToken },
      },
    );
    expect(mockState).toMatchObject({
      status: 200,
      body: { draftMode: "interactive-mock" },
    });
  });
});
