import { HttpResponse, http } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  leagueServer,
  onboarding,
  renderLeaguePage,
  resetLeaguePages,
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

describe("LeaguePage commissioner actions", () => {
  it("routes unfinished setup to commissioner tools", async () => {
    useLeagueApi(onboarding({ canManageLeague: true, claimed: true, setupReady: false }));
    renderLeaguePage();

    expect(await screen.findByRole("link", { name: "Finish setup" })).toHaveAttribute(
      "href",
      "/leagues/sunday-games/commissioner",
    );
    expect(screen.queryByRole("link", { name: "Enter draft" })).not.toBeInTheDocument();
  });

  it("enters a published room only when one exists", async () => {
    useLeagueApi(onboarding({
      canManageLeague: true,
      claimed: true,
      roomId: "room/1",
    }));
    renderLeaguePage();

    expect(await screen.findByRole("link", { name: "Enter draft" })).toHaveAttribute(
      "href",
      "/leagues/sunday-games/draft",
    );
    expect(screen.getByText("Setup")).toBeVisible();
  });

  it("routes a ready commissioner to draft-room creation", async () => {
    useLeagueApi(onboarding({ canManageLeague: true, claimed: true }));
    renderLeaguePage();

    expect(await screen.findByRole("link", { name: "Create draft room" })).toHaveAttribute(
      "href",
      "/leagues/sunday-games/commissioner#live-room",
    );
    expect(screen.getByRole("link", { name: "Manage keepers" })).toHaveAttribute(
      "href",
      "/leagues/sunday-games/commissioner#keepers",
    );
  });

  it("continues from a confirmed team claim to keeper setup", async () => {
    let claimed = false;
    useLeagueApi(onboarding({ canManageLeague: true }));
    leagueServer.use(
      http.get("/onboarding", () => HttpResponse.json(onboarding({
        canManageLeague: true,
        claimed,
      }))),
      http.post("/seasons/:seasonId/team-claims", () => {
        claimed = true;
        return HttpResponse.json({
          membership: {
            leagueId: "league-1",
            ownerId: team.ownerId,
            role: "owner",
            teamId: team.id,
            userId: "user-1",
          },
        });
      }),
    );
    const user = userEvent.setup();
    renderLeaguePage();

    await screen.findByRole("radio", { name: /Short King/i });
    const teamChoices = screen.getByRole("group", { name: "Available teams" });
    await user.click(within(teamChoices).getByText("Short King"));
    await user.click(screen.getByRole("button", { name: "Confirm Short King" }));

    await waitFor(() => {
      expect(screen.getByTestId("league-location"))
        .toHaveTextContent("/leagues/sunday-games/commissioner#keepers");
    });
  });
});
