import { describe, expect, it, vi } from "vitest";
import { closePlatformWebRuntime } from "../src/platform/startPlatformWeb/processLifecycle.js";

describe("platform web process lifecycle", () => {
  it("stops observation and the FantasyPros refresh before closing the server and Postgres", async () => {
    const events: string[] = [];

    await closePlatformWebRuntime({
      stopObserving: () => events.push("observation"),
      stopFantasyProsRefresh: () => events.push("fantasy-pros"),
      closeServer: async () => { events.push("server"); },
      closePostgres: async () => { events.push("postgres"); },
    });

    expect(events).toEqual(["observation", "fantasy-pros", "server", "postgres"]);
  });

  it("closes Postgres when server shutdown fails", async () => {
    const closePostgres = vi.fn(async () => undefined);

    await expect(closePlatformWebRuntime({
      stopObserving: () => undefined,
      stopFantasyProsRefresh: () => undefined,
      closeServer: async () => { throw new Error("server shutdown failed"); },
      closePostgres,
    })).rejects.toThrow("server shutdown failed");
    expect(closePostgres).toHaveBeenCalledOnce();
  });
});
