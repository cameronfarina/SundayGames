import { describe, expect, it, vi } from "vitest";
import { PlatformApiError } from "../../shared/api/http/PlatformApiError";
import { createAppQueryClient } from "./createAppQueryClient";

describe("createAppQueryClient", () => {
  it("does not retry ordinary client errors", async () => {
    const query = vi.fn(() => Promise.reject(new PlatformApiError({
      code: "auth_required",
      message: "Sign in first.",
      status: 401,
    })));
    const queryClient = createAppQueryClient();

    await expect(queryClient.fetchQuery({ queryKey: ["session"], queryFn: query })).rejects.toThrow(
      "Sign in first.",
    );

    expect(query).toHaveBeenCalledOnce();
  });

  it("retries a server failure once", async () => {
    const query = vi.fn()
      .mockRejectedValueOnce(new PlatformApiError({
        code: "server_error",
        message: "Try again.",
        status: 503,
      }))
      .mockResolvedValueOnce("ready");
    const queryClient = createAppQueryClient();

    await expect(queryClient.fetchQuery({ queryKey: ["health"], queryFn: query })).resolves.toBe(
      "ready",
    );

    expect(query).toHaveBeenCalledTimes(2);
  });

  it("limits unknown transport failures to one retry", async () => {
    const query = vi.fn(() => Promise.reject(new Error("Network unavailable.")));
    const queryClient = createAppQueryClient();

    await expect(queryClient.fetchQuery({ queryKey: ["network"], queryFn: query })).rejects.toThrow(
      "Network unavailable.",
    );

    expect(query).toHaveBeenCalledTimes(2);
  });
});
