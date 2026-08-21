import { describe, expect, it, vi } from "vitest";
import { closePlatformWebRuntime } from "../src/platform/startPlatformWeb/processLifecycle.js";

describe("platform web process lifecycle", () => {
  it("stops recurring work before closing the server and Postgres", async () => {
    const events: string[] = [];

    await closePlatformWebRuntime({
      stopObserving: () => events.push("observation"),
      stopSimulationReconciliation: () => events.push("simulations"),
      stopFantasyProsRefresh: () => events.push("fantasy-pros"),
      closeServer: async () => { events.push("server"); },
      closePostgres: async () => { events.push("postgres"); },
    });

    expect(events).toEqual(["observation", "simulations", "fantasy-pros", "server", "postgres"]);
  });

  it("closes Postgres when server shutdown fails", async () => {
    const closePostgres = vi.fn(async () => undefined);

    await expect(closePlatformWebRuntime({
      stopObserving: () => undefined,
      stopSimulationReconciliation: () => undefined,
      stopFantasyProsRefresh: () => undefined,
      closeServer: async () => { throw new Error("server shutdown failed"); },
      closePostgres,
    })).rejects.toThrow("server shutdown failed");
    expect(closePostgres).toHaveBeenCalledOnce();
  });
});
