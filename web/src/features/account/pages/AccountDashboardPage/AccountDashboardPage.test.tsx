import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AccountDashboardPage } from "./AccountDashboardPage";

const metrics = {
  completedMocks: 4,
  historicalImportSeasons: 2,
  savedSimulationOutcomes: 3,
  simulationRuns: 6,
  simulationsCompleted: 150,
};

const dashboard = {
  leagues: [
    {
      draft: { roomId: "room-1", startsAt: "2099-08-30T19:00:00.000Z", status: "countdown" },
      draftFormat: "auction",
      leagueId: "league-1",
      leagueName: "Sunday Fundays",
      leagueSlug: "sunday-fundays",
      membershipRole: "owner",
      metrics,
      provider: "espn",
      readiness: { leagueSetup: "ready", liveDraft: "ready", teamClaim: "ready" },
      seasonId: "season-1",
      seasonStatus: "published",
      seasonYear: 2026,
      teamCount: 12,
      teamDisplayName: "Red Zone Rebels",
    },
    {
      draft: { startsAt: "2099-08-29T18:00:00.000Z" },
      draftFormat: "snake",
      leagueId: "league-2",
      leagueName: "Office League",
      leagueSlug: "office-league",
      membershipRole: "member",
      metrics: { ...metrics, completedMocks: 0, historicalImportSeasons: 0 },
      provider: "sleeper",
      readiness: { leagueSetup: "ready", liveDraft: "needs_attention", teamClaim: "needs_attention" },
      seasonId: "season-2",
      seasonStatus: "published",
      seasonYear: 2026,
      teamCount: 10,
    },
  ],
};

const server = setupServer();

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><AccountDashboardPage /></MemoryRouter>
  </QueryClientProvider>,
);

beforeAll(() => { server.listen({ onUnhandledRequest: "error" }); });
afterEach(() => { server.resetHandlers(); vi.unstubAllEnvs(); });
afterAll(() => { server.close(); });

describe("AccountDashboardPage", () => {
  it("shows upcoming drafts and each league's operating status and activity", async () => {
    vi.stubEnv("TZ", "Europe/Rome");
    server.use(http.get("/account-dashboard", () => HttpResponse.json(dashboard)));
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Loading your leagues");
    const upcoming = await screen.findByRole("list", { name: "Upcoming drafts" });
    expect(within(upcoming).getAllByRole("listitem").map(item => item.textContent)).toEqual([
      expect.stringContaining("Office League"),
      expect.stringContaining("Sunday Fundays"),
    ]);
    const league = screen.getByRole("article", { name: "Sunday Fundays 2026" });
    expect(within(league).getByText(/Red Zone Rebels/u)).toBeVisible();
    expect(within(league).getByText("Draft scheduled")).toBeVisible();
    expect(within(league).getByText("2 seasons")).toBeVisible();
    expect(within(league).getByText("150 simulations")).toBeVisible();
    expect(within(league).getByRole("link", { name: "Open league" }))
      .toHaveAttribute("href", "/leagues/sunday-fundays");
    expect(within(league).getByRole("link", { name: "Enter draft" }))
      .toHaveAttribute("href", "/leagues/sunday-fundays/draft");
  });

  it("offers league setup when the account has no active leagues", async () => {
    server.use(http.get("/account-dashboard", () => HttpResponse.json({ leagues: [] })));
    renderPage();

    expect(await screen.findByRole("heading", { name: "No leagues yet" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Connect a league" })).toHaveAttribute("href", "/connections");
  });

  it("keeps a useful recovery path when the summary cannot load", async () => {
    server.use(http.get("/account-dashboard", () => HttpResponse.json({
      error: { code: "unavailable", message: "Try later." },
    }, { status: 503 })));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your account dashboard");
  });
});
