import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLiveDraftRoom } from "./useLiveDraftRoom";

afterEach(() => { vi.unstubAllGlobals(); });

describe("useLiveDraftRoom", () => {
  it("guards mutations before the room loads and exposes refresh", async () => {
    const pendingResponse = new Promise<Response>(() => undefined);
    vi.stubGlobal("fetch", vi.fn(() => pendingResponse));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const wrapper = ({ children }: { readonly children: ReactNode }) =>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { result, unmount } = renderHook(() => useLiveDraftRoom("room-1"), { wrapper });

    await expect(result.current.runAction({ action: "start" }))
      .rejects.toThrow("The draft room has not loaded yet.");
    await act(async () => { await result.current.refresh(); });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["live-draft-room", "room-1"] });
    unmount();
    queryClient.clear();
  });
});
