import { createPlatformServer, expect, it, jsonFetch, listen, mockRunner, now, readFile, sessionTokenFrom } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer, servers, storePath }) => {
  it("loads file-backed state on startup and persists successful mutations", async () => {
    const dataFilePath = await storePath();
    const { platformServer, baseUrl } = await createListeningServer({ dataFilePath });

    await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner11@example.com",
        password: "secure password",
      }),
    });
    await platformServer.liveDraftRoomSetupRepository?.save({
      seasonId: "season_restart_2026",
      sourceVersion: "catalog-2026",
      playerCatalog: [{ name: "De'Von Achane", position: "RB", expectedPrice: 50 }],
      initialRosters: [{
        teamId: "team_cam",
        playerName: "De'Von Achane",
        position: "RB",
        price: 48,
        source: "keeper",
      }],
      updatedAt: now,
    });
    await platformServer.persist();

    const saved = await readFile(dataFilePath, "utf8");
    const savedAuth = await readFile(`${dataFilePath}.auth.json`, "utf8");
    expect(saved).not.toContain("owner11@example.com");
    expect(savedAuth).toContain("owner11@example.com");
    expect(JSON.parse(saved)).toMatchObject({
      schemaVersion: 1,
      auth: {
        accountCredentials: [],
        sessions: [],
      },
      liveDraftRoomSetups: [{
        seasonId: "season_restart_2026",
        initialRosters: [{ playerName: "De'Von Achane", price: 48 }],
      }],
    });
    expect(JSON.parse(savedAuth)).toMatchObject({
      schemaVersion: 1,
      auth: {
        accountCredentials: [{
          account: {
            email: "owner11@example.com",
            createdAt: now.toISOString(),
          },
        }],
      },
    });

    await platformServer.close();
    const loadedServer = await createPlatformServer({
      dataFilePath,
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
        password: "secure password",
      }),
    });

    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({
      account: {
        email: "owner11@example.com",
      },
    });
    expect(login.setCookie).toContain("mockd_session=");
    await expect(
      loadedServer.liveDraftRoomSetupRepository?.findForSeason("season_restart_2026"),
    ).resolves.toMatchObject({
      initialRosters: [{ playerName: "De'Von Achane", price: 48 }],
    });
  });

  it("persists file-backed auth requests without rewriting workspace state", async () => {
    const dataFilePath = await storePath();
    const { platformServer, baseUrl } = await createListeningServer({ dataFilePath });
    await platformServer.persist();
    const workspaceBefore = await readFile(dataFilePath, "utf8");

    await expect(jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "fast-auth@example.com", password: "secure password" }),
    })).resolves.toMatchObject({ status: 201 });
    expect(await readFile(dataFilePath, "utf8")).toBe(workspaceBefore);
    expect(await readFile(`${dataFilePath}.auth.json`, "utf8")).toContain("fast-auth@example.com");

    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "fast-auth@example.com", password: "secure password" }),
    });
    expect(login.status).toBe(200);
    expect(await readFile(dataFilePath, "utf8")).toBe(workspaceBefore);

    await expect(jsonFetch(baseUrl, "/session", {
      method: "DELETE",
      headers: { "x-session-token": sessionTokenFrom(login) },
    })).resolves.toMatchObject({ status: 200 });
    expect(await readFile(dataFilePath, "utf8")).toBe(workspaceBefore);
  });
});
