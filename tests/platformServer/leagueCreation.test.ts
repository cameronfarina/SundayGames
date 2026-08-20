import { arrayProperty, defaultScoringSettings, expect, it, jsonFetch, loadCurrentPlayerCatalog, propertyValue, sessionTokenFrom, stringProperty, textFetch } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer }) => {
  it("creates, publishes, and provisions a new league from the current catalog", async () => {
    const currentPlayerCatalog = await loadCurrentPlayerCatalog();
    const { baseUrl } = await createListeningServer({
      currentPlayerCatalogProvider: async () => currentPlayerCatalog,
    });
    await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "new-commissioner@example.com", password: "secure password1!" }),
    });
    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "new-commissioner@example.com", password: "secure password1!" }),
    });
    const sessionToken = sessionTokenFrom(login);
    const headers = {
      "content-type": "application/json",
      "x-session-token": sessionToken,
    };
    const created = await jsonFetch(baseUrl, "/leagues", {
      method: "POST",
      headers,
      body: JSON.stringify({
        setup: {
          provider: "espn",
          externalLeagueId: "new-22",
          leagueName: "New League",
          seasonYear: 2026,
          expectedTeamCount: 4,
          teams: [
            { externalTeamId: "1", displayName: "One", managerNames: ["Owner11"] },
            { externalTeamId: "2", displayName: "Two", managerNames: ["Owner01"] },
            { externalTeamId: "3", displayName: "Three", managerNames: ["Owner04"] },
            { externalTeamId: "4", displayName: "Four", managerNames: ["Nick"] },
          ],
          draft: { type: "auction", budgetDollars: 200, minimumBidDollars: 1 },
          scoring: { ...defaultScoringSettings },
          rosterSlots: { QB: 1, RB: 1 },
        },
      }),
    });
    const seasonId = stringProperty(propertyValue(created.body, "season"), "id");

    expect(created.status).toBe(201);
    expect((await jsonFetch(baseUrl, `/seasons/${seasonId}/publish`, {
      method: "POST",
      headers,
      body: JSON.stringify({ confirmed: true }),
    })).status).toBe(200);
    const liveRoom = await jsonFetch(baseUrl, `/seasons/${seasonId}/live-room`, {
      method: "POST",
      headers,
      body: "{}",
    });

    expect(liveRoom).toMatchObject({
      status: 201,
      body: {
        room: {
          seasonId,
          board: expect.any(Array),
        },
      },
    });
    expect(arrayProperty(propertyValue(liveRoom.body, "room"), "board"))
      .toHaveLength(currentPlayerCatalog.length);
  });

  it("passes the trusted proxy client address to auth rate limiting", async () => {
    const seenClientAddresses: string[] = [];
    const { baseUrl } = await createListeningServer({
      trustProxy: true,
      authClientRateLimiter: {
        consume: clientAddress => {
          seenClientAddresses.push(clientAddress);

          return { allowed: true, remainingAttempts: 29, retryAfterMs: 0 };
        },
        reset: () => undefined,
      },
    });

    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.45, 10.0.0.9",
      },
      body: JSON.stringify({
        email: "proxy-user@example.com",
        password: "secure password1!",
      }),
    });

    expect(created.status).toBe(201);
    expect(seenClientAddresses).toEqual(["203.0.113.45"]);
  });

  it("serves an honest fallback when React assets are unavailable", async () => {
    const { baseUrl } = await createListeningServer();

    for (const path of ["/login", "/league", "/draft-room"]) {
      const response = await textFetch(baseUrl, path);
      expect(response.status).toBe(200);
      expect(response.contentType).toBe("text/html; charset=utf-8");
      expect(response.body).toContain("Mockd frontend is unavailable");
      expect(response.body).not.toContain("id=\"auth-panel\"");
      expect(response.body).not.toContain("id=\"draft-room-view\"");
    }
  });
});
