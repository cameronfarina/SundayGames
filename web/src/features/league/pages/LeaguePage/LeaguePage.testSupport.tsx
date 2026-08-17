import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { HttpResponse, http, type JsonBodyType } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LeagueLocationProbe } from "./LeagueLocationProbe.testSupport";
import { LeaguePage } from "./LeaguePage";

export const leagueServer = setupServer();
const unmountLeaguePages: (() => void)[] = [];

export const resetLeaguePages = () => {
  unmountLeaguePages.splice(0).forEach((unmount) => {
    unmount();
  });
};

export const team = {
  id: "team-1",
  leagueSeasonId: "season-1",
  ownerId: "owner-1",
  ownerDisplayName: "Owner11",
  managerDisplayNames: ["Example Manager"],
  abbreviation: "OWN11",
  displayName: "Short King",
  draftOrderPosition: 1,
};

export const season = {
  id: "season-1",
  league: {
    id: "league-1",
    externalLeagueId: "100001",
    name: "Sunday Games",
    provider: "espn",
  },
  leagueId: "league-1",
  seasonYear: 2026,
  teams: [team],
  setupStatus: "published",
  draft: { scheduledAt: "2026-08-30T23:00:00.000Z", timezone: "America/New_York" },
  settings: {
    expectedTeamCount: 14,
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
      rosterMaximums: { QB: 3, RB: 6, WR: 6, TE: 2, DST: 2, K: 2 },
    },
    keeperPolicy: { mode: "previous-cost-multiplier", multiplier: 1.2, rounding: "ceil" },
  },
};

interface OnboardingOptions {
  readonly canManageLeague?: boolean;
  readonly claimed?: boolean;
  readonly roomId?: string;
  readonly setupReady?: boolean;
}

export const onboarding = (options: OnboardingOptions = {}) => ({
  account: { id: "user-1", email: "user@example.com" },
  leagues: [{
    leagueId: "league-1",
    leagueName: "Sunday Games",
    leagueSlug: "sunday-games",
    seasonId: "season-1",
    seasonYear: 2026,
    membership: {
      role: options.canManageLeague === true ? "owner" : "member",
      ...(options.claimed === true ? {
        ownerId: "owner-1",
        teamId: "team-1",
        ownerDisplayName: "Owner11",
        teamDisplayName: "Short King",
      } : {}),
    },
    canManageLeague: options.canManageLeague === true,
    readiness: {
      leagueSetup: options.setupReady === false ? "needs_attention" : "ready",
      teamClaim: options.claimed === true ? "ready" : "needs_attention",
      liveDraft: options.roomId === undefined ? "needs_attention" : "ready",
    },
    nextDraftAt: "2026-08-30T23:00:00.000Z",
    liveDraft: options.roomId === undefined
      ? null
      : { roomId: options.roomId, status: "setup" },
  }],
});

export const useLeagueApi = (
  onboardingBody: JsonBodyType,
  seasonBody: JsonBodyType = { season, claimableTeams: [team] },
  keepersBody: JsonBodyType = { keepers: [] },
) => {
  leagueServer.use(
    http.get("/onboarding", () => HttpResponse.json(onboardingBody)),
    http.get("/seasons/:seasonId", () => HttpResponse.json(seasonBody)),
    http.get("/seasons/:seasonId/keepers", () => HttpResponse.json(keepersBody)),
  );
};

export const renderLeaguePage = (entry = "/league") => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/league" element={<LeaguePage />} />
          <Route path="/leagues/:leagueSlug" element={<LeaguePage />} />
        </Routes>
        <LeagueLocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  unmountLeaguePages.push(result.unmount);
  return result;
};
