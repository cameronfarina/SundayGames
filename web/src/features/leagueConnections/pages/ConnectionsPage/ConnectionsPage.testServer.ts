import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  connectionListFixture,
  discoveredLeaguesFixture,
  syncedConnectionFixture,
} from "../../api/leagueConnections.fixture";
import { connectionDetailFixture } from "../../api/leagueDetail.fixture";

/**
 * Connected leagues belong to the account rather than to one Sunday Games
 * league, so this page never reads /onboarding. Every test runs with
 * onUnhandledRequest: "error", which fails loudly the moment that changes.
 */
export const connectionsServer = setupServer(
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
