import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  connectionListFixture,
  discoveredLeaguesFixture,
  leagueImportFixture,
  syncedConnectionFixture,
} from "../../api/leagueConnections.fixture";
import { connectionDetailFixture } from "../../api/leagueDetail.fixture";

export const onboardingFixture = {
  account: { email: "owner@example.com", id: "account-1" },
  leagues: [{
    canManageLeague: true,
    leagueId: "league-1",
    leagueName: "Sunday Games",
    leagueSlug: "sunday-games",
    liveDraft: null,
    membership: { role: "owner" },
    readiness: { leagueSetup: "ready", liveDraft: "ready", teamClaim: "ready" },
    seasonId: "season-1",
    seasonYear: 2026,
  }],
};

/**
 * The page reads /onboarding only to offer the leagues an import could replace.
 * Every test runs with onUnhandledRequest: "error", which fails loudly the
 * moment any other read creeps in.
 */
export const connectionsServer = setupServer(
  http.get("/league-connections", () => HttpResponse.json(connectionListFixture)),
  http.get("/onboarding", () => HttpResponse.json(onboardingFixture)),
  http.post("/league-connections/discover", () => HttpResponse.json(discoveredLeaguesFixture)),
  http.post("/league-connections", () =>
    HttpResponse.json({ connection: syncedConnectionFixture })),
  http.get("/league-connections/:connectionId", () => HttpResponse.json(connectionDetailFixture)),
  http.post("/league-connections/:connectionId/import", () =>
    HttpResponse.json(leagueImportFixture)),
  http.post("/league-connections/:connectionId/sync", () =>
    HttpResponse.json({ connection: syncedConnectionFixture })),
  http.delete("/league-connections/:connectionId", () => HttpResponse.json({ removed: true })),
);

export const platformError = (status: number, code: string, message: string) =>
  HttpResponse.json({ error: { code, message } }, { status });

export const importReviewError = (message: string, issues: readonly string[]) =>
  HttpResponse.json({ error: { code: "import_needs_review", issues, message } }, { status: 422 });
