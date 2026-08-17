import { describe, expect, it, vi } from "vitest";
import { playerNewsFeedFixture } from "./playerNews.fixture";
import { getPlayerNews } from "./playerNewsApi";

describe("getPlayerNews", () => {
  it("requests a season-scoped feed and validates the response", async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify(playerNewsFeedFixture))));
    const result = await getPlayerNews({
      fetcher,
      seasonId: "season 2026",
      signal: new AbortController().signal,
    });

    expect(result.items[0]?.player).toBe("Ladd McConkey");
    expect(fetcher).toHaveBeenCalledWith(
      "/api/player-news?seasonId=season+2026",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("uses the global fetcher when none is supplied", async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify(playerNewsFeedFixture))));
    vi.stubGlobal("fetch", fetcher);
    await getPlayerNews({
      seasonId: "season-2026",
      signal: new AbortController().signal,
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("requests the global feed when no season is active", async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify(playerNewsFeedFixture))));
    await getPlayerNews({
      fetcher,
      signal: new AbortController().signal,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/player-news",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });
});
