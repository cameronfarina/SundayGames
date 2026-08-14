import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, delay, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { renderCreateLeagueWizard } from "../../test/renderCreateLeagueWizard";

const snakeReview = {
  kind: "review",
  provider: "espn",
  confirmationRequired: true,
  review: {
    externalLeagueId: "100001",
    season: 2026,
    leagueName: null,
    teamCount: 2,
    draft: { type: "snake", rounds: 14, order: ["1", "2"] },
    scoring: {
      pointsPerPassingYard: 0.04, pointsPerPassingTouchdown: 4,
      pointsPerRushingYard: 0.1, pointsPerRushingTouchdown: 6,
      pointsPerReceivingYard: 0.1, pointsPerReceivingTouchdown: 6,
      pointsPerReception: 0.5,
    },
    rosterSlots: {},
    teams: [
      { externalTeamId: "1", displayName: "One", abbreviation: null, draftOrderPosition: 1 },
      { externalTeamId: "2", displayName: "Two", abbreviation: null, draftOrderPosition: 2 },
    ],
  },
  warnings: [],
};

const server = setupServer();
beforeAll(() => { server.listen({ onUnhandledRequest: "error" }); });
afterEach(() => { server.resetHandlers(); });
afterAll(() => { server.close(); });

const reachReference = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByRole("textbox", { name: "League name" }), "Sunday Games");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.type(screen.getByRole("textbox", { name: "ESPN league ID or URL" }), "100001");
};

describe("CreateLeagueWizard errors", () => {
  it("explains when ESPN requires manual entry without offering screenshot analysis", async () => {
    server.use(http.post("/league-imports/espn/review", () => HttpResponse.json({
      kind: "manual-review-required",
      provider: "espn",
      confirmationRequired: true,
      reason: "private_or_unauthorized",
      externalLeagueId: "100001",
      season: 2026,
      confirmationMethods: ["screenshot", "manual"],
      message: "This ESPN league is private. Enter its settings manually.",
    })));
    const user = userEvent.setup();
    renderCreateLeagueWizard();
    await reachReference(user);
    expect(screen.getByText(/automatically read league name, team count, draft format, scoring, roster slots, and team names/i)).toBeVisible();
    expect(screen.getByText(/cannot read private leagues or settings ESPN does not expose/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Review ESPN settings" }));

    expect(await screen.findByRole("status")).toHaveTextContent("private");
    expect(screen.queryByText(/screenshot analyzer/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enter settings manually" }));
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("reports ESPN review as indeterminate work", async () => {
    server.use(http.post("/league-imports/espn/review", async () => {
      await delay(40);
      return HttpResponse.json({
        kind: "manual-review-required", provider: "espn", confirmationRequired: true,
        reason: "settings_need_review", externalLeagueId: "100001", season: 2026,
        confirmationMethods: ["screenshot", "manual"], message: "Enter settings manually.",
      });
    }));
    const user = userEvent.setup();
    renderCreateLeagueWizard();
    await reachReference(user);
    await user.click(screen.getByRole("button", { name: "Review ESPN settings" }));

    expect(screen.getByRole("button", { name: "Reviewing ESPN" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent("Enter settings manually.");
  });

  it("reviews and applies snake leagues with optional ESPN fields omitted", async () => {
    server.use(http.post("/league-imports/espn/review", () => HttpResponse.json(snakeReview)));
    const user = userEvent.setup();
    renderCreateLeagueWizard();
    await reachReference(user);
    await user.click(screen.getByRole("button", { name: "Review ESPN settings" }));

    const review = await screen.findByRole("region", { name: "Imported ESPN settings" });
    expect(review).toHaveTextContent("Unnamed ESPN league");
    expect(review).toHaveTextContent("14-round snake");
    await user.click(screen.getByRole("button", { name: "Use imported settings" }));
    expect(screen.getByRole("button", { name: "Imported settings applied" })).toBeDisabled();
  });

  it("shows ESPN and creation network errors without losing the form", async () => {
    let reviewFails = true;
    server.use(
      http.post("/league-imports/espn/review", () => {
        if (reviewFails) return HttpResponse.json({
          error: { code: "espn_unavailable", message: "ESPN is unavailable." },
        }, { status: 503 });
        return HttpResponse.json({
          kind: "manual-review-required", provider: "espn", confirmationRequired: true,
          reason: "settings_need_review", externalLeagueId: "100001", season: 2026,
          confirmationMethods: ["screenshot", "manual"], message: "Enter settings manually.",
        });
      }),
      http.post("/leagues", () => HttpResponse.json({
        error: { code: "league_invalid", message: "Review the league setup." },
      }, { status: 400 })),
    );
    const user = userEvent.setup();
    renderCreateLeagueWizard();
    await reachReference(user);
    await user.click(screen.getByRole("button", { name: "Review ESPN settings" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("ESPN is unavailable.");

    reviewFails = false;
    await user.click(screen.getByRole("button", { name: "Enter settings manually" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    const teamNames = screen.getAllByRole("textbox", { name: "Team name" });
    for (const [index, input] of teamNames.entries()) await user.type(input, `Team ${String(index + 1)}`);
    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Review the league setup.");
    expect(screen.getAllByRole("textbox", { name: "Team name" })[0]).toHaveValue("Team 1");
  });
});
