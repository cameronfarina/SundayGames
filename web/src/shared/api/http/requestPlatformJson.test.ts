import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformApiError } from "./PlatformApiError";
import { requestPlatformJson } from "./requestPlatformJson";

const accountSchema = z.object({
  account: z.object({ email: z.email(), id: z.string() }),
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestPlatformJson", () => {
  it("returns data only after runtime validation", async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      account: { email: "cam@example.com", id: "account-1" },
    }), { status: 200 })));

    const result = await requestPlatformJson({
      fetcher,
      path: "/session",
      responseSchema: accountSchema,
    });

    expect(result.account.email).toBe("cam@example.com");
    expect(fetcher).toHaveBeenCalledWith("/session", expect.objectContaining({
      credentials: "same-origin",
    }));
  });

  it("surfaces the platform error contract for unsuccessful responses", async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      error: { code: "auth_required", message: "Sign in first." },
    }), { status: 401 })));

    await expect(requestPlatformJson({
      fetcher,
      path: "/session",
      responseSchema: accountSchema,
    })).rejects.toEqual(new PlatformApiError({
      code: "auth_required",
      message: "Sign in first.",
      status: 401,
    }));
  });

  it("rejects successful responses that violate the declared schema", async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      account: { email: "not-an-email" },
    }), { status: 200 })));

    await expect(requestPlatformJson({
      fetcher,
      path: "/session",
      responseSchema: accountSchema,
    })).rejects.toMatchObject({
      code: "invalid_response",
      status: 200,
    });
  });

  it("rejects unreadable success and error bodies without type assertions", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("not-json", { status: 200 }))
      .mockResolvedValueOnce(new Response("not-json", { status: 500 }));

    await expect(requestPlatformJson({
      fetcher,
      path: "/session",
      responseSchema: accountSchema,
    })).rejects.toMatchObject({ code: "invalid_response", status: 200 });
    await expect(requestPlatformJson({
      fetcher,
      path: "/session",
      responseSchema: accountSchema,
    })).rejects.toMatchObject({ code: "invalid_error_response", status: 500 });
  });

  it("uses same-origin fetch when no test transport is supplied", async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      account: { email: "cam@example.com", id: "account-1" },
    }), { status: 200 })));
    vi.stubGlobal("fetch", fetcher);

    await requestPlatformJson({ path: "/session", responseSchema: accountSchema });

    expect(fetcher).toHaveBeenCalledOnce();
  });
});
