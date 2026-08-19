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

const emptyDataset = (name: string) => ({
  name,
  lastFetchedAt: null,
  lastSucceededAt: null,
  rowCount: 0,
  requestCount: 0,
  lastError: null,
});

const emptyDatasets = [
  "rankings-weekly",
  "rankings-ros",
  "rankings-waiver",
  "projections-weekly",
  "projections-ros",
  "players",
  "news-fantasypros",
  "news-rotowire",
  "news-retention",
].map(emptyDataset);

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
          {
            name: "players",
            lastFetchedAt: now.toISOString(),
            lastSucceededAt: now.toISOString(),
            rowCount: 8525,
            requestCount: 1,
            lastError: null,
          },
          ...emptyDatasets.slice(6),
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

  it("reports why a dataset is empty instead of hiding the failure", async () => {
    // The production defect: projections-ros stored zero rows and the status
    // payload gave no way to tell a failed fetch from one that never ran.
    const repository = new InMemoryFantasyProsRepository();
    const now = new Date("2026-09-10T12:00:00.000Z");
    await repository.claimRefresh({ dataset: "projections-ros", now, cadenceMs: 1000 });
    await repository.recordRefreshOutcome({
      dataset: "projections-ros",
      now,
      requestCount: 6,
      rowCount: 0,
      error: "QB: FantasyPros request to /nfl/2026/projections failed with 429.",
    });
    const handle = handlerFor({ fantasyProsRepository: repository, fantasyProsConfigured: true });
    const { sessionToken } = await createLoggedInAccount(handle, "failed@mockd.local");

    const response = await handle({
      method: "GET",
      path: "/fantasypros-status",
      sessionToken,
    });

    expect(response.body).toMatchObject({
      datasets: expect.arrayContaining([{
        name: "projections-ros",
        lastFetchedAt: now.toISOString(),
        lastSucceededAt: null,
        rowCount: 0,
        requestCount: 6,
        lastError: "QB: FantasyPros request to /nfl/2026/projections failed with 429.",
      }]),
    });
  });

  it("is an observable route root so production requests are logged", () => {
    expect(observableRouteRoots.has("fantasypros-status")).toBe(true);
  });
});
