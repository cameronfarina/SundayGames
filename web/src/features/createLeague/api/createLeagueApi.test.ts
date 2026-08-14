import { describe, expect, it, vi } from "vitest";
import { createInitialLeagueDraft, leagueDraftReducer } from "../model/createLeagueDraft";
import { createLeagueSetup } from "../model/createLeagueValidation";
import { importedReviewFixture } from "../test/importedReviewFixture";
import { createLeague, reviewEspnLeague } from "./createLeagueApi";

describe("create league API", () => {
  it("reviews an ESPN ID through the authenticated platform boundary", async () => {
    let requestBody: unknown;
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof init?.body !== "string") throw new Error("Expected a JSON request body.");
      requestBody = JSON.parse(init.body);
      return Promise.resolve(new Response(JSON.stringify(importedReviewFixture), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    });

    const response = await reviewEspnLeague({ leagueIdOrUrl: "214674", season: 2026 }, fetcher);

    expect(response.kind).toBe("review");
    expect(requestBody).toEqual({ leagueIdOrUrl: "214674", season: 2026 });
    expect(fetcher).toHaveBeenCalledWith("/league-imports/espn/review", expect.objectContaining({
      credentials: "same-origin",
      method: "POST",
    }));
  });

  it("parses manual-review and rejects malformed responses", async () => {
    const manualFetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      kind: "manual-review-required",
      provider: "espn",
      confirmationRequired: true,
      reason: "private_or_unauthorized",
      externalLeagueId: "214674",
      season: 2026,
      confirmationMethods: ["screenshot", "manual"],
      message: "This league is private. Enter its settings manually.",
    }), { status: 200 })));
    const malformedFetcher = vi.fn(() => Promise.resolve(new Response("{}", { status: 200 })));

    await expect(reviewEspnLeague({ leagueIdOrUrl: "214674", season: 2026 }, manualFetcher))
      .resolves.toMatchObject({ kind: "manual-review-required" });
    await expect(reviewEspnLeague({ leagueIdOrUrl: "214674", season: 2026 }, malformedFetcher))
      .rejects.toMatchObject({ code: "invalid_response" });
  });

  it("posts the confirmed setup and returns the created season", async () => {
    let requestBody: unknown;
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof init?.body !== "string") throw new Error("Expected a JSON request body.");
      requestBody = JSON.parse(init.body);
      return Promise.resolve(new Response(JSON.stringify({ season: {
        id: "season-new",
        league: { id: "league-new", externalLeagueId: "mockd-2026-league", name: "League", provider: "mockd" },
        leagueId: "league-new",
        seasonYear: 2026,
        teams: [],
        settings: {
          expectedTeamCount: 2,
          draftFormat: "auction",
          scoring: {
            passingYards: 0.04, passingTouchdown: 4, rushingYards: 0.1,
            rushingTouchdown: 6, receivingYards: 0.1, receivingTouchdown: 6, reception: 0.5,
          },
          auction: { budgetDollars: 200, minimumBidDollars: 1 },
          roster: {
            rosterSize: 16, lineup: { QB: 1 }, lineupSlotCount: 16,
            rosterMaximums: { QB: 1, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
          },
          keeperPolicy: { mode: "previous-cost-multiplier", multiplier: 1.2, rounding: "ceil" },
        },
        setupStatus: "draft",
      } }), { status: 201 }));
    });
    let draft = createInitialLeagueDraft(2026);
    draft = leagueDraftReducer(draft, { type: "set-league-name", value: "League" });
    draft = leagueDraftReducer(draft, { type: "set-team-count", value: 2 });
    const setup = createLeagueSetup(draft);

    await expect(createLeague(setup, fetcher)).resolves.toMatchObject({ season: { id: "season-new" } });
    expect(requestBody).toEqual({ setup });
  });

  it("surfaces platform errors from creation", async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      error: { code: "league_invalid", message: "Review the league setup." },
    }), { status: 400 })));
    const setup = createLeagueSetup(createInitialLeagueDraft(2026));

    await expect(createLeague(setup, fetcher)).rejects.toMatchObject({ code: "league_invalid" });
  });
});
