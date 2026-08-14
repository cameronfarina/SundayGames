import { createPlatformServer, expect, it, jsonFetch, mockRunner, now, startPlatformServer } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer, servers }) => {
  it("keeps createPlatformServer unbound and starts listening only through the start helper", async () => {
    const platformServer = await createPlatformServer({
      simulationRunner: mockRunner,
      now: () => now,
    });
    servers.push(platformServer);

    expect(platformServer.server.listening).toBe(false);

    const startedServer = await startPlatformServer({
      simulationRunner: mockRunner,
      now: () => now,
      allowPublicSignup: true,
      port: 0,
      host: "127.0.0.1",
    });
    servers.push(startedServer);

    expect(startedServer.server.listening).toBe(true);
    expect(startedServer.url).toBe(`http://127.0.0.1:${startedServer.port}`);

    const created = await jsonFetch(startedServer.url, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "start-helper@example.com",
        password: "secure password",
      }),
    });

    expect(created.status).toBe(201);
  });

  it("returns adapter JSON errors for malformed request bodies", async () => {
    const { baseUrl } = await createListeningServer();

    const response = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{\"email\":",
    });

    expect(response).toEqual({
      status: 400,
      contentType: "application/json; charset=utf-8",
      body: {
        error: {
          code: "invalid_json",
          message: "Request body must be valid JSON.",
        },
      },
    });
  });
});
