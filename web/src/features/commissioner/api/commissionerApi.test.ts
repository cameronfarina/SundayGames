import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import { jsonResponse } from "../test/commissionerFixtures";
import { commissionerApi } from "./commissionerApi";

describe("commissionerApi", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("creates an unscheduled room with an explicit empty setup", async () => {
    const fetcher: PlatformFetch = vi.fn(() => Promise.resolve(jsonResponse({
      room: { roomId: "room-1", status: "setup" },
    })));
    vi.stubGlobal("fetch", fetcher);

    await expect(commissionerApi.createRoom("season/1"))
      .resolves.toEqual({ room: { roomId: "room-1", status: "setup" } });

    expect(fetcher).toHaveBeenCalledWith(
      "/seasons/season%2F1/live-room",
      expect.objectContaining({ body: "{}", method: "POST" }),
    );
  });
});
