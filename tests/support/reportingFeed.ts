import { vi } from "vitest";

const rotowireSample = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title>De'Von Achane: Limited in practice.</title>
    <description>Achane was limited on Wednesday.</description>
    <link>https://www.rotowire.com/football/news.php?id=1</link>
    <pubDate>Sat, 16 Aug 2026 22:01:00 -0400</pubDate>
  </item>
</channel></rss>`;

const espnSample = {
  articles: [{
    headline: "Ladd McConkey expected to lead the passing game",
    description: "Chargers coaches pointed to McConkey as the top target.",
    published: "2026-08-16T22:10:00Z",
    links: { web: { href: "https://www.espn.com/nfl/story/_/id/1" } },
  }],
};

/**
 * The player news route reads a public reporting feed. A test that reaches a
 * real host fails whenever that host is slow or blocked, so feed requests are
 * answered locally while every other request still reaches the server.
 */
export const stubReportingFeed = (): void => {
  const realFetch = globalThis.fetch;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const target = typeof input === "string"
      ? input
      : input instanceof URL ? input.href : input.url;
    if (target.includes("rotowire.com")) {
      return new Response(rotowireSample, {
        headers: { "content-type": "application/rss+xml" },
      });
    }
    if (target.includes("espn.com")) {
      return new Response(JSON.stringify(espnSample), {
        headers: { "content-type": "application/json" },
      });
    }
    return await realFetch(input, init);
  });
};
