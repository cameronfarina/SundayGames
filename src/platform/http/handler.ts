import { authRoots, routeAuth } from "./auth/routeAuth.js";
import type {
  PlatformApp,
  PlatformHttpHandler,
  PlatformHttpServices,
} from "./contracts.js";
import { errorResponseFor } from "./errors/errorResponse.js";
import { parsedRequestFor, secureSessionCookieFor } from "./request/parsedRequest.js";
import { notFound } from "./responses.js";
import { routeFantasyProsStatus } from "./routes/fantasyProsStatus.js";
import { routeAccountOnboarding } from "./routes/accountOnboarding.js";
import { routeAccountDashboard } from "./routes/accountDashboard.js";
import { routePlatformDraftOperations } from "../platformDraftOperations.js";
import { routeHistoricalImports } from "./routes/historicalImports.js";
import { routeInvitations } from "./routes/invitations/index.js";
import { routeJobs } from "./routes/jobs.js";
import { routeLeagueConnections } from "./routes/leagueConnections/index.js";
import { routeLeagueImports } from "./routes/leagueImports.js";
import { routeLeagues } from "./routes/leagues.js";
import { routeLiveRooms } from "./routes/liveRooms/index.js";
import { routeMockSessions } from "./routes/mockSessions.js";
import { routeOnboarding } from "./routes/onboarding.js";
import { routePlayerCatalog } from "./routes/playerCatalog/index.js";
import { routePracticeShortlist } from "./routes/practiceShortlist.js";
import { routePricingSnapshots } from "./routes/pricingSnapshots.js";
import { routeHealthProbe, routeReadinessProbe } from "./routes/probes.js";
import { routeSeason } from "./routes/season/index.js";
import { routeSeasonMockDrafts } from "./routes/seasonMock/route.js";
import { routeSeasonSimulations } from "./routes/seasonSimulation/route.js";
import { routeSimulations } from "./routes/simulations.js";

export const createPlatformHttpHandler = (
  app: PlatformApp,
  services: PlatformHttpServices = {},
): PlatformHttpHandler => async request => {
  try {
    const parsedRequest = parsedRequestFor(request);
    const [root] = parsedRequest.segments;
    if (root === "healthz" && parsedRequest.segments.length === 1) {
      return routeHealthProbe(parsedRequest);
    }
    if (root === "readyz" && parsedRequest.segments.length === 1) {
      return await routeReadinessProbe(parsedRequest, services);
    }
    if (root !== undefined && authRoots.has(root)) {
      return await routeAuth(app, parsedRequest, services, secureSessionCookieFor(request));
    }
    if (root === "onboarding") {
      return await routeOnboarding(app, parsedRequest, services.onboardingRepository);
    }
    if (root === "account-onboarding" && parsedRequest.segments.length === 1) {
      return await routeAccountOnboarding(app, parsedRequest, services);
    }
    if (root === "account-dashboard") {
      return await routeAccountDashboard(app, parsedRequest, services.accountDashboardRepository);
    }
    if (root === "platform-admin" && services.platformDraftOperations !== undefined) {
      return await routePlatformDraftOperations(app, parsedRequest, services.platformDraftOperations);
    }
    if (root === "player-catalog" && parsedRequest.segments.length === 1) {
      return await routePlayerCatalog(app, parsedRequest, services);
    }
    if (root === "fantasypros-status") {
      return await routeFantasyProsStatus(app, parsedRequest, services);
    }
    if (root === "league-connections") {
      return await routeLeagueConnections(app, parsedRequest, services);
    }
    if (root === "league-imports") return await routeLeagueImports(app, parsedRequest, services);
    if (root === "leagues") return await routeLeagues(app, parsedRequest);
    if (root === "invitations") return await routeInvitations(app, parsedRequest, services);
    if (root === "seasons") return await routeSeason(app, parsedRequest, services);
    if (root === "simulations") return await routeSimulations(app, parsedRequest, services);
    if (root === "historical-imports") {
      return await routeHistoricalImports(app, parsedRequest, services);
    }
    if (root === "pricing-snapshots") return await routePricingSnapshots(app, parsedRequest);
    if (root === "jobs") return await routeJobs(app, parsedRequest);
    if (root === "mock-sessions") return await routeMockSessions(app, parsedRequest);
    if (root === "season-mock-drafts") {
      return await routeSeasonMockDrafts(app, parsedRequest, services);
    }
    if (root === "season-simulations") {
      return await routeSeasonSimulations(app, parsedRequest, services);
    }
    if (root === "practice-shortlist") {
      return await routePracticeShortlist(app, parsedRequest, services);
    }
    if (root === "live-rooms") return await routeLiveRooms(app, parsedRequest, services);
    return notFound();
  } catch (error) {
    return errorResponseFor(error);
  }
};
