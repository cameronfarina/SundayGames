import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  connectionListFixture,
  discoveredLeaguesFixture,
  syncedConnectionFixture,
} from "../../api/leagueConnections.fixture";
import { connectionDetailFixture } from "../../api/leagueDetail.fixture";

export const onboardingFixture = {
  account: { id: "account-1", email: "owner@example.com" },
  leagues: [{
    canManageLeague: true,
    leagueId: "league-manual",
    leagueName: "Manual Home League",
    leagueSlug: "manual-home-league",
    liveDraft: null,
    membership: { role: "owner" },
    readiness: {
      leagueSetup: "ready",
      liveDraft: "needs_attention",
      teamClaim: "needs_attention",
    },
    seasonId: "season-manual-2026",
    seasonYear: 2026,
  }],
};

export const connectionsServer = setupServer(
  http.get("/onboarding", () => HttpResponse.json(onboardingFixture)),
  http.get("/league-connections", () => HttpResponse.json(connectionListFixture)),
  http.post("/league-connections/discover", () => HttpResponse.json(discoveredLeaguesFixture)),
  http.post("/league-connections", () =>
    HttpResponse.json({ connection: syncedConnectionFixture })),
  http.get("/league-connections/:connectionId", () => HttpResponse.json(connectionDetailFixture)),
  http.post("/league-connections/:connectionId/sync", () =>
    HttpResponse.json({ connection: syncedConnectionFixture })),
  http.delete("/league-connections/:connectionId", () => HttpResponse.json({ removed: true })),
);

export const platformError = (status: number, code: string, message: string) =>
  HttpResponse.json({ error: { code, message } }, { status });
