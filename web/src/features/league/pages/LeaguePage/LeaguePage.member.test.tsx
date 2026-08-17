import { HttpResponse, delay, http } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  leagueServer,
  onboarding,
  renderLeaguePage,
  resetLeaguePages,
  season,
  team,
  useLeagueApi,
} from "./LeaguePage.testSupport";

beforeAll(() => {
  leagueServer.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  resetLeaguePages();
  leagueServer.resetHandlers();
});
afterAll(() => {
  leagueServer.close();
});

describe("LeaguePage member experience", () => {
  it("loads the requested league from its clean public URL", async () => {
    useLeagueApi(onboarding({ claimed: true }));

    renderLeaguePage("/leagues/sunday-games");

    expect(await screen.findByRole("heading", { name: "Sunday Games" })).toBeVisible();
  });

  it("places team claiming before league details and saves the selection", async () => {
    let claimed = false;
    useLeagueApi(onboarding());
    leagueServer.use(
      http.post("/seasons/:seasonId/team-claims", () => {
        claimed = true;
        return HttpResponse.json({
          membership: {
            userId: "user-1",
            leagueId: "league-1",
            role: "member",
            ownerId: team.ownerId,
            teamId: team.id,
          },
        });
      }),
      http.get("/onboarding", () => HttpResponse.json(onboarding({ claimed }))),
    );
    const user = userEvent.setup();
    renderLeaguePage();

    const claimHeading = await screen.findByRole("heading", { name: "Claim your team" });
    const settingsHeading = screen.getByRole("heading", { name: "League settings" });
    expect(claimHeading.compareDocumentPosition(settingsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(screen.getByRole("button", { name: "Select a team" })).toBeDisabled();
    const teamChoices = screen.getByRole("group", { name: "Available teams" });
    await user.click(within(teamChoices).getByText("Short King"));
    expect(screen.getByRole("radio", { name: /Short King/i })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Confirm Short King" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Claim your team" })).not.toBeInTheDocument());
  });

  it("shows settings, owners, keepers, and room status to a member", async () => {
    useLeagueApi(onboarding({ claimed: true }), undefined, {
      keepers: [{
        teamId: team.id,
        playerId: "devon-achane",
        playerName: "De'Von Achane",
        position: "RB",
        price: 50,
        source: "keeper",
      }],
    });
    renderLeaguePage();

    expect(await screen.findByRole("heading", { name: "Sunday Games" })).toBeVisible();
    expect(screen.getByText("$200 auction · $1 minimum bid")).toBeVisible();
    expect(screen.getByText("De'Von Achane")).toBeVisible();
    expect(screen.getByText("$50 keeper")).toBeVisible();
    expect(screen.getByText("Draft room not ready")).toBeVisible();
    expect(screen.queryByRole("link", { name: /setup/i })).not.toBeInTheDocument();
  });

  it("shows snake keepers, owner fallbacks, and an unscheduled draft", async () => {
    const ownerOnlyTeam = { ...team, managerDisplayNames: undefined };
    useLeagueApi(
      {
        ...onboarding({ claimed: true }),
        leagues: [{ ...onboarding({ claimed: true }).leagues[0], nextDraftAt: undefined }],
      },
      { season: { ...season, teams: [ownerOnlyTeam] }, claimableTeams: [] },
      { keepers: [{
        teamId: team.id,
        playerName: "De'Von Achane",
        position: "RB",
        price: 50,
        keeperRound: 3,
      }] },
    );
    renderLeaguePage();

    expect(await screen.findByText("No draft time scheduled")).toBeVisible();
    expect(screen.getByText("Owner11")).toBeVisible();
    expect(screen.getByText("Round 3 keeper")).toBeVisible();
  });

  it("shows claim progress and a server error", async () => {
    useLeagueApi(onboarding());
    leagueServer.use(http.post("/seasons/:seasonId/team-claims", async () => {
      await delay(40);
      return HttpResponse.json({
        error: { code: "team_unavailable", message: "That team was already claimed." },
      }, { status: 409 });
    }));
    const user = userEvent.setup();
    renderLeaguePage();

    await screen.findByRole("radio", { name: /Short King/i });
    const teamChoices = screen.getByRole("group", { name: "Available teams" });
    await user.click(within(teamChoices).getByText("Short King"));
    await user.click(screen.getByRole("button", { name: "Confirm Short King" }));
    expect(screen.getByRole("button", { name: "Claiming team..." })).toBeDisabled();
    expect(await screen.findByRole("alert")).toHaveTextContent("That team was already claimed.");
  });
});
