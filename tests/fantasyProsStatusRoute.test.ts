import { describe, expect, it } from "vitest";
import { InMemoryFantasyProsRepository } from "../src/platform/fantasyPros.js";
import { InMemoryPlatformStore, createPlatformApp } from "../src/platform/platformApp.js";
import {
  createPlatformHttpHandler,
  type PlatformHttpHandler,
  type PlatformHttpServices,
} from "../src/platform/platformHttp.js";
import { observableRouteRoots } from "../src/platform/platformNodeHttp/constants.js";
import { mockRunner } from "./platformHttp/support/fixtures.js";
import { createLoggedInAccount } from "./platformHttp/support/auth.js";

const handlerFor = (services: PlatformHttpServices): PlatformHttpHandler =>
  createPlatformHttpHandler(
    createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner }),
    services,
  );

const emptyDatasets = [
  { name: "rankings-weekly", lastFetchedAt: null, rowCount: 0 },
  { name: "rankings-ros", lastFetchedAt: null, rowCount: 0 },
  { name: "rankings-waiver", lastFetchedAt: null, rowCount: 0 },
  { name: "projections-weekly", lastFetchedAt: null, rowCount: 0 },
  { name: "projections-ros", lastFetchedAt: null, rowCount: 0 },
  { name: "players", lastFetchedAt: null, rowCount: 0 },
];

describe("FantasyPros status route", () => {
  it("requires a signed-in account", async () => {
    const handle = handlerFor({ fantasyProsRepository: new InMemoryFantasyProsRepository() });

    await expect(handle({ method: "GET", path: "/fantasypros-status" })).resolves.toEqual({
      status: 401,
      body: { error: { code: "auth_required", message: "Sign in before using this workspace." } },
    });
  });

  it("reports every dataset as empty when the feature is dark", async () => {
    const handle = handlerFor({});
    const { sessionToken } = await createLoggedInAccount(handle, "dark@mockd.local");

    await expect(handle({ method: "GET", path: "/fantasypros-status", sessionToken }))
      .resolves.toEqual({
        status: 200,
        body: { configured: false, datasets: emptyDatasets },
      });
  });

  it("reports the stored sync health once datasets have been fetched", async () => {
    const repository = new InMemoryFantasyProsRepository();
    const now = new Date("2026-09-10T12:00:00.000Z");
    await repository.claimRefresh({ dataset: "players", now, cadenceMs: 1000 });
    await repository.recordRefreshOutcome({
      dataset: "players",
      now,
      requestCount: 1,
      rowCount: 8525,
    });
    const handle = handlerFor({ fantasyProsRepository: repository, fantasyProsConfigured: true });
    const { sessionToken } = await createLoggedInAccount(handle, "synced@mockd.local");

    const response = await handle({
      method: "GET",
      path: "/fantasypros-status",
      sessionToken,
    });

    expect(response).toEqual({
      status: 200,
      body: {
        configured: true,
        datasets: [
          ...emptyDatasets.slice(0, 5),
          { name: "players", lastFetchedAt: now.toISOString(), rowCount: 8525 },
        ],
      },
    });
  });

  it("rejects a write and an unknown sub-path", async () => {
    const handle = handlerFor({ fantasyProsRepository: new InMemoryFantasyProsRepository() });
    const { sessionToken } = await createLoggedInAccount(handle, "writer@mockd.local");

    await expect(handle({ method: "POST", path: "/fantasypros-status", sessionToken }))
      .resolves.toMatchObject({ status: 405 });
    await expect(handle({ method: "GET", path: "/fantasypros-status/players", sessionToken }))
      .resolves.toMatchObject({ status: 404 });
  });

  it("is an observable route root so production requests are logged", () => {
    expect(observableRouteRoots.has("fantasypros-status")).toBe(true);
  });
});
