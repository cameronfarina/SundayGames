import { describe, expect, it } from "vitest";
import {
  describeDraft,
  describeRoster,
  describeScoring,
  selectActiveLeague,
} from "./leagueDisplay";
import { onboardingSchema } from "../../../shared/api/onboarding/onboardingSchema";
import { leagueSeasonSchema } from "../api/leagueSchemas";

const onboarding = onboardingSchema.parse({
  account: { id: "user-1", email: "user@example.com" },
  leagues: [
    {
      leagueId: "league-1",
      leagueName: "Sunday Games",
      leagueSlug: "sunday-games",
      seasonId: "season-1",
      seasonYear: 2026,
      membership: { role: "member" },
      canManageLeague: false,
      readiness: {
        leagueSetup: "ready",
        teamClaim: "needs_attention",
        liveDraft: "needs_attention",
      },
      liveDraft: null,
    },
  ],
});

const seasonInput = {
  id: "season-1",
  league: { id: "league-1", externalLeagueId: "100001", name: "Sunday Games", provider: "espn" },
  leagueId: "league-1",
  seasonYear: 2026,
  teams: [],
  setupStatus: "published",
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

describe("league display", () => {
  it("selects the first league or an explicitly requested league", () => {
    expect(selectActiveLeague(onboarding, null)).toMatchObject({ seasonId: "season-1" });
    expect(selectActiveLeague(onboarding, "season-1")).toMatchObject({ seasonId: "season-1" });
    expect(selectActiveLeague(onboarding, "missing")).toBeUndefined();
  });

  it("describes auction settings", () => {
    const season = leagueSeasonSchema.parse(seasonInput);
    expect(describeDraft(season.settings)).toBe("$200 auction · $1 minimum bid");
    expect(describeScoring(season.settings)).toBe("0.5 PPR · 4 point pass TD");
    expect(describeRoster(season.settings)).toBe("16 players · 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX, 1 DST, 1 K, 7 BENCH");
  });

  it("describes snake and legacy auction settings", () => {
    const snake = leagueSeasonSchema.parse({
      ...seasonInput,
      settings: {
        ...seasonInput.settings,
        draftFormat: "snake",
        auction: undefined,
        snake: { rounds: 16, order: [], reversal: "standard" },
      },
    });
    const legacy = leagueSeasonSchema.parse({
      ...seasonInput,
      settings: {
        expectedTeamCount: 14,
        auction: { budgetDollars: 250, minimumBidDollars: 2 },
        roster: seasonInput.settings.roster,
        keeperPolicy: seasonInput.settings.keeperPolicy,
      },
    });

    expect(describeDraft(snake.settings)).toBe("16-round snake · Standard reversal");
    expect(describeDraft(legacy.settings)).toBe("$250 auction · $2 minimum bid");
    expect(describeScoring(legacy.settings)).toBe("Scoring details unavailable");
  });

  it("describes third-round reversal and omits empty roster slots", () => {
    const snake = leagueSeasonSchema.parse({
      ...seasonInput,
      settings: {
        ...seasonInput.settings,
        draftFormat: "snake",
        auction: undefined,
        snake: { rounds: 15, order: [], reversal: "third-round" },
        roster: {
          ...seasonInput.settings.roster,
          lineup: { QB: 1, RB: 2, TE: 0 },
        },
      },
    });

    expect(describeDraft(snake.settings)).toBe("15-round snake · Third-round reversal");
    expect(describeRoster(snake.settings)).toBe("16 players · 1 QB, 2 RB");
  });
});
