import {
  expect,
  it,
  jsonFetch,
  loadCurrentPlayerCatalog,
  sessionTokenFrom,
} from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer }) => {
  it("serves authenticated player news without an active league", async () => {
    const { baseUrl } = await createListeningServer({
      currentPlayerCatalogProvider: loadCurrentPlayerCatalog,
    });
    await jsonFetch(baseUrl, "/accounts", {
      body: JSON.stringify({ email: "news@example.com", password: "secure password" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const login = await jsonFetch(baseUrl, "/sessions", {
      body: JSON.stringify({ email: "news@example.com", password: "secure password" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const response = await jsonFetch(baseUrl, "/api/player-news?source=local", {
      headers: { "x-session-token": sessionTokenFrom(login) },
    });

    expect(response).toMatchObject({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: {
        sourceMode: "local",
        items: expect.arrayContaining([
          expect.objectContaining({ player: "De'Von Achane", position: "RB" }),
        ]),
      },
    });
  });

  it("requires authentication for global player news", async () => {
    const { baseUrl } = await createListeningServer();

    await expect(jsonFetch(baseUrl, "/api/player-news?source=local")).resolves.toMatchObject({
      status: 401,
      body: { error: { code: "auth_required" } },
    });
  });
});
