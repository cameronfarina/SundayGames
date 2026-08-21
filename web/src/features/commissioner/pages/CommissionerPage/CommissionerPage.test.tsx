import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { requestPath } from "../../test/commissionerFixtures";
import { CommissionerPage } from "./CommissionerPage";

const onboarding = {
  account: { id: "account-user", email: "user@example.com" },
  leagues: [{
    leagueId: "league-1",
    leagueName: "Sunday Games",
    leagueSlug: "sunday-games",
    seasonId: "season-1",
    seasonYear: 2026,
    membership: { role: "owner" },
    canManageLeague: true,
    readiness: {
      leagueSetup: "needs_attention",
      teamClaim: "ready",
      liveDraft: "needs_attention",
    },
    liveDraft: null,
  }],
};

const season = {
  id: "season-1",
  league: {
    id: "league-1",
    externalLeagueId: "100001",
    name: "Sunday Games",
    provider: "mockd",
  },
  leagueId: "league-1",
  seasonYear: 2026,
  teams: [{
    id: "team-1",
    leagueSeasonId: "season-1",
    ownerId: "owner-owner11",
    ownerDisplayName: "Owner11",
    managerDisplayNames: ["Example Manager"],
    abbreviation: "OWN11",
    displayName: "Short King",
    draftOrderPosition: 1,
  }],
  settings: {
    expectedTeamCount: 1,
    draftFormat: "auction",
    scoring: {
      passingYards: 0.04,
      passingTouchdown: 4,
      rushingYards: 0.1,
      rushingTouchdown: 6,
      receivingYards: 0.1,
      receivingTouchdown: 6,
      reception: 0.5,
    },
    auction: { budgetDollars: 200, minimumBidDollars: 1 },
    roster: {
      rosterSize: 16,
      lineup: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, DST: 1, K: 1, BENCH: 7 },
      lineupSlotCount: 9,
      rosterMaximums: { QB: 3, RB: 6, WR: 6, TE: 2, K: 2, DST: 2 },
    },
    keeperPolicy: { mode: "previous-cost-multiplier", multiplier: 1.2, rounding: "ceil" },
  },
  setupStatus: "draft",
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });

const renderPage = (
  canManageLeague = true,
  failPath = "",
  initialEntry = "/commissioner?seasonId=season-1",
  pendingPaths: readonly string[] = [],
) => {
  const respond: PlatformFetch = input => {
    const path = requestPath(input);
    if (pendingPaths.includes(path)) return new Promise<Response>(() => undefined);
    if (path === failPath) {
      return Promise.resolve(jsonResponse({ error: { code: "failed", message: "Request failed." } }, 500));
    }
    if (path === "/onboarding") {
      return Promise.resolve(jsonResponse({
        ...onboarding,
        leagues: onboarding.leagues.map(league => ({ ...league, canManageLeague })),
      }));
    }
    if (path === "/seasons/season-1") return Promise.resolve(jsonResponse({ season, claimableTeams: [] }));
    if (path === "/seasons/season-1/keepers") return Promise.resolve(jsonResponse({ keepers: [] }));
    if (path === "/invitations?seasonId=season-1") {
      return Promise.resolve(jsonResponse({ invitations: [], claimedTeamIds: [] }));
    }
    if (path === "/seasons/season-1/historical-imports") {
      return Promise.resolve(jsonResponse({ seasonYears: [] }));
    }
    throw new Error(`Unexpected request: ${path}`);
  };
  const fetcher = vi.fn(respond);
  vi.stubGlobal("fetch", fetcher);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [{ path: "/commissioner", element: <CommissionerPage /> }],
    { initialEntries: [initialEntry] },
  );

  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { ...view, fetcher };
};

describe("CommissionerPage", () => {
  afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });
  it("opens a focused overview with league access and no redundant teams tab", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Commissioner" })).toBeVisible();
    expect(screen.getByText("Sunday Games · 2026")).toBeVisible();
    expect(screen.getByText("$200 auction")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create and publish league" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button", { name: "Teams" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Historical pricing" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Live draft room" })).not.toBeInTheDocument();
    expect(screen.queryByText("Paste a full team list")).not.toBeInTheDocument();
    expect(screen.queryByText(/screenshot/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });

  it("switches between overview, live draft, and history without a long mixed page", async () => {
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "League info" });

    await user.click(screen.getByRole("button", { name: "Live Draft" }));
    expect(await screen.findByRole("heading", { name: "Live draft room" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "League info" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "History" }));
    expect(await screen.findByRole("heading", { name: "Historical pricing" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Live draft room" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "History" })).toHaveAttribute("aria-current", "page");

    await user.click(screen.getByRole("button", { name: "Overview" }));
    expect(await screen.findByRole("heading", { name: "League info" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  });

  it("denies the workspace when the selected membership cannot manage it", async () => {
    renderPage(false);

    expect(await screen.findByRole("heading", { name: "Commissioner access required" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "League info" })).not.toBeInTheDocument();
  });

  it("opens the live draft tab for the legacy live-room hash", async () => {
    renderPage(true, "", "/commissioner#live-room");
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { name: "Live draft room" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Live Draft" })).toHaveAttribute("aria-current", "page");

    await user.click(screen.getByRole("button", { name: "Overview" }));
    expect(await screen.findByRole("heading", { name: "League info" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  });

  it("can switch from the legacy live-room hash to another named tab", async () => {
    renderPage(true, "", "/commissioner?seasonId=season-1#live-room");
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { name: "Live draft room" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "History" }));

    expect(await screen.findByRole("heading", { name: "Historical pricing" })).toBeVisible();
    expect(screen.getByRole("button", { name: "History" })).toHaveAttribute("aria-current", "page");
  });

  it("reports onboarding and league workspace failures", async () => {
    const { unmount } = renderPage(true, "/onboarding");
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your leagues.");
    unmount();
    renderPage(true, "/seasons/season-1");
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load league setup.");
  });

  it.each([
    ["keepers", "/seasons/season-1/keepers"],
    ["invitations", "/invitations?seasonId=season-1"],
  ])("renders History when %s fail", async (_dependency, failPath) => {
    renderPage(true, failPath, "/commissioner?seasonId=season-1&section=history");

    expect(await screen.findByRole("heading", { name: "Historical pricing" })).toBeVisible();
    expect(screen.queryByText("Could not load league setup.")).not.toBeInTheDocument();
  });

  it("renders Live Draft while keepers and invitations are pending", async () => {
    renderPage(
      true,
      "",
      "/commissioner?seasonId=season-1&section=live-draft",
      ["/seasons/season-1/keepers", "/invitations?seasonId=season-1"],
    );

    expect(await screen.findByRole("heading", { name: "Live draft room" })).toBeVisible();
    expect(screen.queryByText("Loading league setup...")).not.toBeInTheDocument();
  });

  it.each([
    ["History", "/commissioner?seasonId=season-1&section=history", "Historical pricing"],
    ["Live Draft", "/commissioner?seasonId=season-1&section=live-draft", "Live draft room"],
  ])("does not load Overview data on %s", async (_section, initialEntry, heading) => {
    const { fetcher } = renderPage(true, "", initialEntry);

    expect(await screen.findByRole("heading", { name: heading })).toBeVisible();
    const requestedPaths = fetcher.mock.calls.map(([input]) => requestPath(input));
    expect(requestedPaths).not.toContain("/seasons/season-1/keepers");
    expect(requestedPaths).not.toContain("/invitations?seasonId=season-1");
  });

  it("keeps Overview blocked when its invitation data fails", async () => {
    renderPage(true, "/invitations?seasonId=season-1");

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load league setup.");
    expect(screen.queryByRole("heading", { name: "League info" })).not.toBeInTheDocument();
  });

  it("keeps Overview loading while its keeper data is pending", async () => {
    renderPage(
      true,
      "",
      "/commissioner?seasonId=season-1",
      ["/seasons/season-1/keepers"],
    );

    expect(await screen.findByText("Loading league setup...")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "League info" })).not.toBeInTheDocument();
  });
});
