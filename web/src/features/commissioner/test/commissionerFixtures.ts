import { seasonSchema } from "../api/seasonSchemas";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import { onboardingLeagueSchema } from "../../../shared/api/onboarding/onboardingSchema";

export const auctionSeason = seasonSchema.parse({
  id: "season-1",
  league: { id: "league-1", externalLeagueId: "100001", name: "Sunday Games", provider: "mockd" },
  leagueId: "league-1",
  seasonYear: 2026,
  teams: [{
    id: "team-1", leagueSeasonId: "season-1", ownerId: "owner-owner11",
    ownerDisplayName: "Owner11", managerDisplayNames: ["Example Manager"], abbreviation: "OWN11",
    displayName: "Short King", draftOrderPosition: 1,
  }],
  settings: {
    expectedTeamCount: 1,
    draftFormat: "auction",
    scoring: {
      passingYards: 0.04, passingTouchdown: 4, rushingYards: 0.1,
      rushingTouchdown: 6, receivingYards: 0.1, receivingTouchdown: 6, reception: 0.5,
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
});

export const snakeSeason = seasonSchema.parse({
  ...auctionSeason,
  settings: {
    ...auctionSeason.settings,
    draftFormat: "snake",
    auction: undefined,
    snake: { rounds: 16, order: ["team-1"] },
  },
});

export const ownerLeague = onboardingLeagueSchema.parse({
  leagueId: "league-1", leagueName: "Sunday Games", leagueSlug: "sunday-games", seasonId: "season-1", seasonYear: 2026,
  membership: { role: "owner" }, canManageLeague: true,
  readiness: { leagueSetup: "needs_attention", teamClaim: "ready", liveDraft: "needs_attention" },
  liveDraft: null,
});

export const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, status });

export const requestPath = (input: RequestInfo | URL): string => {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.toString() : input.url;
};

export const requestBody = (init?: RequestInit): string =>
  typeof init?.body === "string" ? init.body : "";

export const withStoredHistoricalImports = (
  fetcher: PlatformFetch,
  seasonYears: () => readonly number[],
): PlatformFetch => (input, init) =>
  requestPath(input).endsWith("/historical-imports")
    ? Promise.resolve(jsonResponse({ seasonYears: seasonYears() }))
    : fetcher(input, init);
