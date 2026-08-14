import { InMemoryPlatformStore, createClientAddressRateLimiter, createPlatformApp, createPlatformHttpHandler, describe, expect, it, mockRunner, now, vi } from "../support/index.js";
import type { PlatformApp, PlatformHttpRequest } from "../support/index.js";

describe("platform HTTP contract", () => {
it("rate limits live draft mutations before invoking domain changes", async () => {
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      simulationRunner: mockRunner,
    });
    const findAccount = vi.fn<PlatformApp["findAccountBySessionToken"]>();
    findAccount.mockResolvedValue({
      id: "account-1",
      email: "rate-limit@example.com",
      createdAt: now,
      updatedAt: now,
    });
    app.findAccountBySessionToken = findAccount;
    app.pauseLiveDraftRoom = vi.fn<PlatformApp["pauseLiveDraftRoom"]>();
    app.getLiveDraftRoomState = vi.fn<PlatformApp["getLiveDraftRoomState"]>();
    const handle = createPlatformHttpHandler(app, {
      liveDraftMutationRateLimiter: createClientAddressRateLimiter({
        maxAttempts: 1,
        windowMs: 60_000,
        maxTrackedEmails: 100,
      }),
    });
    const request: PlatformHttpRequest = {
      method: "POST",
      path: "/live-rooms/room-1/pause",
      sessionToken: "session-1",
      now,
      body: {
        expectedRevision: 1,
        idempotencyKey: "pause-1",
      },
    };

    await expect(handle(request)).resolves.toMatchObject({ status: 200 });
    await expect(handle({
      ...request,
      body: { expectedRevision: 2, idempotencyKey: "pause-2" },
    })).resolves.toEqual({
      status: 429,
      headers: { "Retry-After": "60" },
      body: {
        error: {
          code: "rate_limited",
          message: "Too many live draft changes. Try again shortly.",
        },
      },
    });
    expect(app.pauseLiveDraftRoom).toHaveBeenCalledTimes(1);
    expect(app.getLiveDraftRoomState).toHaveBeenCalledTimes(1);
  });
});
