import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { playerNewsFeedFixture } from "../../api/playerNews.fixture";
import { PlayerNewsPage } from "./PlayerNewsPage";

const server = setupServer(
  http.get("/onboarding", () => HttpResponse.json({
    account: { email: "user@example.com", id: "user-1" },
    leagues: [{
      canManageLeague: false,
      leagueId: "league-1",
      leagueName: "Sunday Games",
      liveDraft: null,
      membership: { role: "member", teamId: "team-1" },
      readiness: { leagueSetup: "ready", liveDraft: "ready", teamClaim: "ready" },
      seasonId: "season-2026",
      seasonYear: 2026,
    }],
  })),
  http.get("/api/player-news", () => HttpResponse.json(playerNewsFeedFixture)),
);

const renderPage = (initialEntry = "/player-news?seasonId=season-2026") => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <PlayerNewsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("PlayerNewsPage", () => {
  beforeAll(() => {
    Object.defineProperties(Element.prototype, {
      hasPointerCapture: { configurable: true, value: () => false },
      releasePointerCapture: { configurable: true, value: () => undefined },
      scrollIntoView: { configurable: true, value: () => undefined },
      setPointerCapture: { configurable: true, value: () => undefined },
    });
    server.listen({ onUnhandledRequest: "error" });
  });
  afterEach(() => {
    localStorage.clear();
    server.resetHandlers();
  });
  afterAll(() => { server.close(); });

  it("renders first-class player news with search and personal player tabs", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole("heading", { name: "Player news" })).toBeVisible();
    expect(await screen.findByRole("textbox", { name: "Search news" })).toBeVisible();
    await user.click(await screen.findByRole("button", { name: "Add De'Von Achane to my players" }));
    await user.click(screen.getByRole("tab", { name: "My players (1)" }));
    expect(screen.getByText("De'Von Achane was limited in practice.")).toBeVisible();
    expect(screen.queryByText("Ladd McConkey: Expected to lead the passing game.")).not.toBeInTheDocument();
  });

  it("loads the global feed before the user joins a league", async () => {
    server.use(http.get("/onboarding", () => HttpResponse.json({
      account: { email: "new@example.com", id: "user-new" },
      leagues: [],
    })));

    renderPage("/player-news");

    expect(await screen.findByText("De'Von Achane was limited in practice.")).toBeVisible();
  });

  it("uses the first league when the URL does not select one", async () => {
    server.use(http.get("/onboarding", () => HttpResponse.json({
      account: { email: "user@example.com", id: "user-1" },
      leagues: [{
        canManageLeague: false,
        leagueId: "league-1",
        leagueName: "Sunday Games",
        liveDraft: null,
        membership: { role: "member" },
        readiness: { leagueSetup: "ready", liveDraft: "ready", teamClaim: "needs_attention" },
        seasonId: "season-2026",
        seasonYear: 2026,
      }],
    })));

    renderPage();

    expect(await screen.findByText("Ladd McConkey: Expected to lead the passing game.")).toBeVisible();
  });
});
