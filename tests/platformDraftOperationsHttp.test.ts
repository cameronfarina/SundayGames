import { describe, expect, it, vi } from "vitest";
import { createPlatformApp, InMemoryPlatformStore } from "../src/platform/platformApp.js";
import {
  routePlatformDraftOperations,
  type PlatformDraftOperationsRecord,
} from "../src/platform/platformDraftOperations.js";
import { parsedRequestFor } from "../src/platform/http/request/parsedRequest.js";

const now = new Date("2026-08-22T12:00:00.000Z");
const draft: PlatformDraftOperationsRecord = {
  draftFormat: "auction",
  endedAt: null,
  leagueId: "league-1",
  leagueName: "Sunday Games",
  roomId: "room-1",
  roomStatus: "setup",
  seasonId: "season-1",
  seasonName: "2026 season",
  seasonYear: 2026,
  startedAt: null,
  startsAt: new Date("2026-08-22T23:00:00.000Z"),
  teamCount: 12,
};

const request = (path: string, method: string, sessionToken = "", token?: string) =>
  parsedRequestFor({
    headers: token === undefined ? {} : { "x-sundaygames-draft-digest-token": token },
    method,
    now,
    path,
    sessionToken,
  });

const setupAccount = async (email: string) => {
  const app = createPlatformApp({
    store: new InMemoryPlatformStore(),
    simulationRunner: () => { throw new Error("Simulation is not used by this test."); },
  });
  const password = "draft ops password 1!";
  const account = await app.createAccount({ email, password, now });
  const login = await app.login({ email, password, now });
  if (login === null) throw new Error("Expected login fixture.");
  return { account, app, sessionToken: login.sessionToken };
};

describe("platform draft operations HTTP", () => {
  it("allows an environment-approved account to read the global schedule", async () => {
    const { account, app, sessionToken } = await setupAccount("creator@example.com");
    const response = await routePlatformDraftOperations(
      app,
      request("/api/platform-admin/drafts", "GET", sessionToken),
      {
        administratorAccountIds: new Set([account.id]),
        repository: { listScheduledDrafts: vi.fn().mockResolvedValue([draft]) },
        timezone: "America/New_York",
      },
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ today: [{ leagueName: "Sunday Games" }] });
  });

  it("does not grant platform access to an ordinary league administrator", async () => {
    const { app, sessionToken } = await setupAccount("league-admin@example.com");
    const response = await routePlatformDraftOperations(
      app,
      request("/api/platform-admin/drafts", "GET", sessionToken),
      {
        administratorAccountIds: new Set(),
        repository: { listScheduledDrafts: vi.fn().mockResolvedValue([draft]) },
        timezone: "America/New_York",
      },
    );

    expect(response).toEqual({
      body: { error: { code: "platform_admin_required", message: "Platform administrator access is required." } },
      status: 403,
    });
  });

  it("does not reserve the creator browser path for JSON", async () => {
    const { account, app, sessionToken } = await setupAccount("creator-browser@example.com");
    const response = await routePlatformDraftOperations(
      app,
      request("/platform-admin/drafts", "GET", sessionToken),
      {
        administratorAccountIds: new Set([account.id]),
        repository: { listScheduledDrafts: vi.fn().mockResolvedValue([draft]) },
        timezone: "America/New_York",
      },
    );

    expect(response.status).toBe(404);
  });

  it("posts a Discord digest only when the independent trigger token matches", async () => {
    const { app } = await setupAccount("creator@example.com");
    const postDiscord = vi.fn().mockResolvedValue(undefined);
    const services = {
      administratorAccountIds: new Set<string>(),
      digest: { postDiscord, triggerToken: "secret-trigger-token" },
      repository: { listScheduledDrafts: vi.fn().mockResolvedValue([draft]) },
      timezone: "America/New_York",
    };

    const denied = await routePlatformDraftOperations(
      app,
      request("/platform-admin/draft-digest", "POST", "", "wrong-token"),
      services,
    );
    expect(denied.status).toBe(403);
    expect(postDiscord).not.toHaveBeenCalled();

    const accepted = await routePlatformDraftOperations(
      app,
      request("/platform-admin/draft-digest", "POST", "", "secret-trigger-token"),
      services,
    );
    expect(accepted).toEqual({ status: 204, body: null });
    expect(postDiscord).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining("1 draft scheduled today"),
    }));
  });
});
