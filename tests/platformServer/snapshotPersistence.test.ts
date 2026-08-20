import { FakePostgresClient, createPlatformServer, expect, it, jsonFetch, listen, mockRunner, now } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer, servers }) => {
  it("loads Postgres-backed state on startup and persists successful mutations", async () => {
    const postgresClient = new FakePostgresClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient,
      initializePostgresSchema: true,
    });

    await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner11@example.com",
        password: "secure password1!",
      }),
    });

    expect(postgresClient.row).toMatchObject({
      revision: 1,
      snapshot_json: {
        schemaVersion: 1,
        auth: {
          accountCredentials: [
            {
              account: {
                email: "owner11@example.com",
                createdAt: now.toISOString(),
              },
            },
          ],
        },
      },
    });

    await platformServer.close();
    const loadedServer = await createPlatformServer({
      postgresClient,
      simulationRunner: mockRunner,
      now: () => now,
    });
    servers.push(loadedServer);
    const loadedBaseUrl = await listen(loadedServer);

    const login = await jsonFetch(loadedBaseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner11@example.com",
        password: "secure password1!",
      }),
    });

    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({
      account: {
        email: "owner11@example.com",
      },
    });
    expect(login.setCookie).toContain("mockd_session=");
  });
});
