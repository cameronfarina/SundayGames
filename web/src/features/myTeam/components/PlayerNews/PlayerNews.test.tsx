import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { playerNewsFeedFixture } from "../../api/playerNews.fixture";
import { PlayerNews } from "./PlayerNews";

beforeAll(() => {
  Object.defineProperties(Element.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
    setPointerCapture: { configurable: true, value: () => undefined },
  });
});

const plan = [{
  createdAt: "2026-08-16T12:00:00.000Z",
  id: "target-1",
  leagueId: "league-1",
  maxBid: 25,
  playerName: "Ladd McConkey",
  position: "WR",
  priority: 1,
  seasonId: "season-2026",
  updatedAt: "2026-08-16T12:00:00.000Z",
  userId: "user-1",
}];

const renderNews = (fetcher: typeof fetch, rosterNames: readonly string[] = ["De'Von Achane"]) => {
  vi.stubGlobal("fetch", fetcher);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>
    <PlayerNews rosterNames={rosterNames} seasonId="season-2026" />
  </QueryClientProvider>);
};

const requestUrl = (input: RequestInfo | URL): string => input instanceof Request
  ? input.url
  : input instanceof URL ? input.href : input;

const successfulFetch = vi.fn((input: RequestInfo | URL) => Promise.resolve(
  requestUrl(input).startsWith("/practice-shortlist")
    ? new Response(JSON.stringify({ items: plan }))
    : new Response(JSON.stringify(playerNewsFeedFixture))));

describe("PlayerNews", () => {
  it("filters RotoWire and local updates by roster, draft plan, source, and search", async () => {
    const user = userEvent.setup();
    renderNews(successfulFetch);
    expect(await screen.findByText("De'Von Achane was limited in practice.")).toBeVisible();
    expect(screen.queryByText("Ladd McConkey: Expected to lead the passing game.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Players" }));
    await user.click(screen.getByRole("option", { name: "Draft plan" }));
    expect(screen.getByText("Ladd McConkey: Expected to lead the passing game.")).toBeVisible();

    await user.click(screen.getByRole("combobox", { name: "Players" }));
    await user.click(screen.getByRole("option", { name: "All players" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);

    await user.type(screen.getByRole("textbox", { name: "Search updates" }), "nothing matches");
    expect(screen.getByText("No updates match this player view yet.")).toBeVisible();
    await user.clear(screen.getByRole("textbox", { name: "Search updates" }));

    await user.click(screen.getByRole("combobox", { name: "Source" }));
    await user.click(screen.getByRole("option", { name: "RotoWire" }));
    await waitFor(() => {
      expect(successfulFetch).toHaveBeenCalledWith(
        "/api/player-news?seasonId=season-2026&source=rotowire-rss",
        expect.anything(),
      );
    });
    await user.click(screen.getByRole("combobox", { name: "Source" }));
    await user.click(screen.getByRole("option", { name: "Mockd evidence" }));
    await waitFor(() => {
      expect(successfulFetch).toHaveBeenCalledWith(
        "/api/player-news?seasonId=season-2026&source=local",
        expect.anything(),
      );
    });
    await user.click(screen.getByRole("combobox", { name: "Source" }));
    await user.click(screen.getByRole("option", { name: "All sources" }));
    await waitFor(() => {
      expect(successfulFetch).toHaveBeenCalledWith(
        "/api/player-news?seasonId=season-2026&source=all",
        expect.anything(),
      );
    });
  });

  it("defaults to the draft plan when no roster exists", async () => {
    renderNews(successfulFetch, []);
    expect(await screen.findByText("Ladd McConkey: Expected to lead the passing game.")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Players" })).toHaveTextContent("Draft plan");
  });

  it("reports plan failures", async () => {
    renderNews(vi.fn((input: RequestInfo | URL) => Promise.resolve(requestUrl(input).startsWith("/practice-shortlist")
      ? new Response(JSON.stringify({ error: { code: "plan_failed", message: "Plan unavailable." } }), { status: 503 })
      : new Response(JSON.stringify(playerNewsFeedFixture)))));
    expect(await screen.findByRole("alert")).toHaveTextContent("Plan unavailable.");
  });

  it("retries a failed news provider", async () => {
    let newsRequests = 0;
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      if (requestUrl(input).startsWith("/practice-shortlist")) {
        return Promise.resolve(new Response(JSON.stringify({ items: plan })));
      }
      newsRequests += 1;
      return Promise.resolve(newsRequests === 1
        ? new Response(JSON.stringify({ error: { code: "news_failed", message: "News unavailable." } }), { status: 503 })
        : new Response(JSON.stringify(playerNewsFeedFixture)));
    });
    const user = userEvent.setup();
    renderNews(fetcher);
    expect(await screen.findByRole("alert")).toHaveTextContent("News unavailable.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("De'Von Achane was limited in practice.")).toBeVisible();
  });
});
