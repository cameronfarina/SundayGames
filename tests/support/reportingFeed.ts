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

/**
 * The player news route reads a public reporting feed. A test that reaches the
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
    return await realFetch(input, init);
  });
};
