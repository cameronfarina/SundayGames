import { afterEach, describe, expect, it, vi } from "vitest";
import { getOnboarding } from "./onboardingApi";

const responseBody = {
  account: { email: "user@example.com", id: "account-1" },
  leagues: [],
};

const response = (body: unknown): Response => new Response(JSON.stringify(body), {
  headers: { "content-type": "application/json" },
  status: 200,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("onboarding API", () => {
  it("validates injected requests and forwards cancellation", async () => {
    const fetcher = vi.fn(() => Promise.resolve(response(responseBody)));
    const controller = new AbortController();

    await expect(getOnboarding({ fetcher, signal: controller.signal })).resolves.toEqual(responseBody);
    expect(fetcher).toHaveBeenCalledWith("/onboarding", expect.objectContaining({
      signal: controller.signal,
    }));
  });

  it("uses the default transport without an optional signal", async () => {
    const fetcher = vi.fn(() => Promise.resolve(response(responseBody)));
    vi.stubGlobal("fetch", fetcher);

    await expect(getOnboarding()).resolves.toEqual(responseBody);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("rejects malformed onboarding data", async () => {
    const fetcher = vi.fn(() => Promise.resolve(response({ leagues: "invalid" })));

    await expect(getOnboarding({ fetcher })).rejects.toMatchObject({ code: "invalid_response" });
  });
});
