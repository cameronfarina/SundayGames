import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
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

const renderPage = (canManageLeague = true, failPath = "") => {
  const respond: PlatformFetch = input => {
    const path = requestPath(input);
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
    throw new Error(`Unexpected request: ${path}`);
  };
  const fetcher = vi.fn(respond);
  vi.stubGlobal("fetch", fetcher);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [{ path: "/commissioner", element: <CommissionerPage /> }],
    { initialEntries: ["/commissioner?seasonId=season-1"] },
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

describe("CommissionerPage", () => {
  afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });
  it("loads the selected league into an operational commissioner workspace", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Commissioner" })).toBeVisible();
    expect(screen.getByText("Sunday Games · 2026")).toBeVisible();
    expect(screen.getByText("$200 auction")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Keepers" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Draft history" })).toBeVisible();
    expect(screen.queryByText(/screenshot/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });

  it("denies the workspace when the selected membership cannot manage it", async () => {
    renderPage(false);

    expect(await screen.findByRole("heading", { name: "Commissioner access required" }))
      .toBeVisible();
    expect(screen.queryByRole("heading", { name: "Keepers" })).not.toBeInTheDocument();
  });

  it("reports onboarding and league workspace failures", async () => {
    const { unmount } = renderPage(true, "/onboarding");
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your leagues.");
    unmount();
    renderPage(true, "/seasons/season-1");
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load league setup.");
  });
});
