import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export const assignedLeague = {
  leagueId: "league-1",
  leagueName: "Sunday Games",
  seasonId: "season-2026",
  seasonYear: 2026,
  membership: {
    role: "member",
    ownerId: "owner11",
    teamId: "team-owner11",
    ownerDisplayName: "Owner11",
    teamDisplayName: "Short King",
  },
  canManageLeague: false,
  readiness: {
    leagueSetup: "ready",
    teamClaim: "ready",
    liveDraft: "needs_attention",
  },
  liveDraft: null,
};

export const onboarding = (league: Record<string, unknown> = assignedLeague) => ({
  account: { id: "account-user", email: "user@example.com" },
  leagues: [league],
});

export const season = (draftFormat = "auction", seasonId = "season-2026") => ({
  season: {
    id: seasonId,
    leagueId: "league-1",
    seasonYear: 2026,
    setupStatus: "published",
    teams: [{
      id: "team-owner11",
      ownerId: "owner11",
      ownerDisplayName: "Owner11",
      displayName: "Short King",
      draftOrderPosition: 7,
    }],
    settings: {
      draftFormat,
      auction: draftFormat === "auction"
        ? { budgetDollars: 200, minimumBidDollars: 1 }
        : undefined,
      snake: draftFormat === "snake"
        ? { rounds: 16, order: ["owner11"], reversal: "standard" }
        : undefined,
      roster: { rosterSize: 16, lineupSlotCount: 9, lineup: { QB: 1 } },
    },
  },
  claimableTeams: [],
});

export const keepers = [{
  teamId: "team-owner11",
  playerId: "devon-achane",
  playerName: "De'Von Achane",
  position: "RB",
  price: 50,
  source: "keeper",
}];

export const server = setupServer();

export const usePreDraftHandlers = (): void => {
  server.use(
    http.get("/onboarding", () => HttpResponse.json(onboarding())),
    http.get("/seasons/season-2026", () => HttpResponse.json(season())),
    http.get("/seasons/season-2026/keepers", () => HttpResponse.json({ keepers })),
  );
};
