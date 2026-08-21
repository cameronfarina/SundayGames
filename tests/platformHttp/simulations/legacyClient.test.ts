import {
  InMemoryPlatformStore,
  createLoggedInAccount,
  createPlatformApp,
  createPlatformHttpHandler,
  describe,
  expect,
  it,
  mockRunner,
} from "../support/index.js";

const legacyError = (stream: string): unknown => {
  const data = stream.split("\n").find(line => line.startsWith("data: "))?.slice(6);
  if (data === undefined) throw new Error("Legacy stream did not contain an error payload.");
  return JSON.parse(data);
};

describe("legacy season simulation client compatibility", () => {
  it("returns a terminal refresh error without creating a launch", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const account = await createLoggedInAccount(handle, "legacy-simulation@example.com");

    const response = await handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: account.sessionToken,
      headers: { accept: "text/event-stream" },
      body: { count: 25, seasonId: "missing-season" },
    });

    expect(response).toMatchObject({
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
    });
    expect(response.body).toEqual(expect.stringContaining("event: error\n"));
    expect(legacyError(String(response.body))).toEqual({
      error: {
        code: "simulation_client_upgrade_required",
        message: expect.stringMatching(/refresh/iu),
      },
    });
    await expect(app.listSimulationRuns({
      actorSessionToken: account.sessionToken,
      seasonId: "missing-season",
    })).resolves.toEqual([]);
  });
});
