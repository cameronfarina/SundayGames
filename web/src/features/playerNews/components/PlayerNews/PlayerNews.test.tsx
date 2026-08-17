import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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

const renderNews = (fetcher: typeof fetch) => {
  vi.stubGlobal("fetch", fetcher);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>
    <PlayerNews accountId="account-1" seasonId="season-2026" />
  </QueryClientProvider>);
};

const successfulFetch = vi.fn(() => Promise.resolve(
  new Response(JSON.stringify(playerNewsFeedFixture)),
));

describe("PlayerNews", () => {
  afterEach(() => { localStorage.clear(); });

  it("follows players and filters the feed to My players", async () => {
    const user = userEvent.setup();
    renderNews(successfulFetch);
    expect(await screen.findByText("De'Von Achane was limited in practice.")).toBeVisible();
    expect(screen.getByText("Ladd McConkey: Expected to lead the passing game.")).toBeVisible();
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("button", { name: "Add De'Von Achane to my players" }));
    await user.click(screen.getByRole("tab", { name: "My players (1)" }));
    expect(screen.getByText("De'Von Achane was limited in practice.")).toBeVisible();
    expect(screen.queryByText("Ladd McConkey: Expected to lead the passing game.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove De'Von Achane from my players" }));
    expect(screen.getByText("No updates match this player view yet.")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "All" }));
    expect(screen.getByText("Ladd McConkey: Expected to lead the passing game.")).toBeVisible();
  });

  it("filters the feed by search text", async () => {
    const user = userEvent.setup();
    renderNews(successfulFetch);
    await user.type(await screen.findByRole("textbox", { name: "Search news" }), "MIA");
    expect(screen.getByText("De'Von Achane was limited in practice.")).toBeVisible();
    expect(screen.queryByText("Ladd McConkey: Expected to lead the passing game.")).not.toBeInTheDocument();
    await user.clear(screen.getByRole("textbox", { name: "Search news" }));
    expect(await screen.findByText("Ladd McConkey: Expected to lead the passing game.")).toBeVisible();
  });

  it("offers no source picker, because news is published reporting only", async () => {
    renderNews(successfulFetch);
    await screen.findByRole("textbox", { name: "Search news" });

    expect(screen.queryByRole("combobox", { name: "Source" })).not.toBeInTheDocument();
    expect(successfulFetch).toHaveBeenCalledWith(
      "/api/player-news?seasonId=season-2026",
      expect.anything(),
    );
  });

  it("searches provider items that omit team and position metadata", async () => {
    const sparseFeed = {
      ...playerNewsFeedFixture,
      items: playerNewsFeedFixture.items.map(item => ({
        ...item,
        position: undefined,
        teamAbbreviation: undefined,
      })),
    };
    const user = userEvent.setup();
    renderNews(vi.fn(() => Promise.resolve(new Response(JSON.stringify(sparseFeed)))));
    await user.type(await screen.findByRole("textbox", { name: "Search news" }), "lead the passing game");
    expect(screen.getByText("Ladd McConkey: Expected to lead the passing game.")).toBeVisible();
  });

  it("retries a failed news provider", async () => {
    let requests = 0;
    const fetcher = vi.fn(() => {
      requests += 1;
      return Promise.resolve(requests === 1
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
