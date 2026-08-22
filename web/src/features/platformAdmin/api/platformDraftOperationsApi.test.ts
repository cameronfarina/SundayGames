import { describe, expect, it, vi } from "vitest";
import { fetchPlatformDraftOperations } from "./platformDraftOperationsApi";

describe("fetchPlatformDraftOperations", () => {
  it("uses an injected fetcher for the creator schedule", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      generatedAt: "2026-08-22T12:00:00.000Z",
      timezone: "America/New_York",
      today: [],
      upcoming: [],
      summary: {
        estimatedDraftDurationMinutes: 180,
        liveNow: 0,
        peakConcurrentDrafts: 0,
        peakWindow: null,
        roomsNotCreated: 0,
        scheduledToday: 0,
        scheduledUpcoming: 0,
      },
    }), { headers: { "content-type": "application/json" } }));

    await expect(fetchPlatformDraftOperations(fetcher)).resolves.toMatchObject({ today: [] });
    expect(fetcher).toHaveBeenCalledWith("/api/platform-admin/drafts", expect.any(Object));
  });
});
