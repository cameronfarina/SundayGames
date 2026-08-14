import { InMemoryPlatformStore, createPlatformApp, createPlatformHttpHandler, describe, expect, it, mockRunner, vi } from "./support/index.js";

describe("platform HTTP contract", () => {
it("serves unauthenticated health and readiness probes", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);

    await expect(handle({ method: "GET", path: "/healthz" })).resolves.toEqual({
      status: 200,
      body: {
        service: "mockd-platform",
        status: "ok",
      },
    });
    await expect(handle({ method: "GET", path: "/readyz" })).resolves.toEqual({
      status: 200,
      body: {
        service: "mockd-platform",
        status: "ok",
      },
    });
    await expect(handle({ method: "POST", path: "/readyz" })).resolves.toEqual({
      status: 405,
      body: {
        error: {
          code: "method_not_allowed",
          message: "Method is not allowed for this route.",
        },
      },
    });

  });

it("reports unavailable when a readiness dependency fails", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const readinessProbe = vi.fn(async () => false);
    const handle = createPlatformHttpHandler(app, { readinessProbe });

    await expect(handle({ method: "GET", path: "/healthz" })).resolves.toMatchObject({
      status: 200,
      body: { status: "ok" },
    });
    await expect(handle({ method: "GET", path: "/readyz" })).resolves.toEqual({
      status: 503,
      body: {
        service: "mockd-platform",
        status: "unavailable",
      },
    });
    expect(readinessProbe).toHaveBeenCalledOnce();
  });
});
