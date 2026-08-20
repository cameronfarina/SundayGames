import { FakePostgresClient, deferred, expect, it, jsonFetch } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer }) => {
  it("recovers Postgres-backed runtime after a snapshot write conflict", async () => {
    const postgresClient = new FakePostgresClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient,
    });

    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner11@example.com",
        password: "secure password1!",
      }),
    });
    expect(created.status).toBe(201);

    if (postgresClient.row === undefined) {
      throw new Error("Expected first account mutation to persist a Postgres snapshot.");
    }
    postgresClient.row = {
      revision: 2,
      snapshot_json: postgresClient.row.snapshot_json,
    };

    const conflict = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "stale-local@example.com",
        password: "secure password1!",
      }),
    });

    expect(conflict).toEqual({
      status: 409,
      contentType: "application/json; charset=utf-8",
      body: {
        error: {
          code: "snapshot_write_conflict",
          message: "Stored draft data changed before this request could be saved. Reload and try again.",
        },
      },
    });
    expect(platformServer.postgresStore?.loadedRevision).toBe(2);

    const failedLocalLogin = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "stale-local@example.com",
        password: "secure password1!",
      }),
    });
    expect(failedLocalLogin).toMatchObject({
      status: 401,
      body: {
        error: {
          code: "invalid_credentials",
        },
      },
    });

    const committedLogin = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner11@example.com",
        password: "secure password1!",
      }),
    });
    expect(committedLogin.status).toBe(200);
  });

  it("serializes Postgres snapshot-backed HTTP mutations in process", async () => {
    const postgresClient = new FakePostgresClient();
    const firstInsertEntered = deferred();
    const releaseFirstInsert = deferred();
    postgresClient.nextInsertGate = {
      entered: firstInsertEntered.resolve,
      release: releaseFirstInsert.promise,
    };
    const { baseUrl } = await createListeningServer({
      postgresClient,
    });

    const firstCreate = jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "first@example.com",
        password: "secure password1!",
      }),
    });

    await firstInsertEntered.promise;
    const secondCreate = jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "second@example.com",
        password: "secure password1!",
      }),
    });

    releaseFirstInsert.resolve();

    await expect(Promise.all([firstCreate, secondCreate])).resolves.toMatchObject([
      { status: 201 },
      { status: 201 },
    ]);
    expect(postgresClient.row?.revision).toBe(2);

    const firstLogin = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "first@example.com",
        password: "secure password1!",
      }),
    });
    const secondLogin = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "second@example.com",
        password: "secure password1!",
      }),
    });

    expect(firstLogin.status).toBe(200);
    expect(secondLogin.status).toBe(200);
  });
});
