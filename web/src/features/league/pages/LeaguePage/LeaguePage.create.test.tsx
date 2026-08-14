import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createdSeasonFixture } from "../../../createLeague/test/createdSeasonFixture";
import {
  leagueServer,
  onboarding,
  renderLeaguePage,
  resetLeaguePages,
  useLeagueApi,
} from "./LeaguePage.testSupport";

const emptyOnboarding = { account: { id: "user-1", email: "cam@example.com" }, leagues: [] };

beforeAll(() => { leagueServer.listen({ onUnhandledRequest: "error" }); });
afterEach(() => {
  resetLeaguePages();
  leagueServer.resetHandlers();
});
afterAll(() => { leagueServer.close(); });

const completeManualLeague = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByRole("textbox", { name: "League name" }), "Sunday Games");
  fireEvent.change(screen.getByRole("spinbutton", { name: "Number of teams" }), {
    target: { value: "2" },
  });
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(screen.getByRole("button", { name: "Enter settings manually" }));
  for (let step = 0; step < 3; step += 1) {
    await user.click(screen.getByRole("button", { name: "Next" }));
  }
  const teamOne = within(screen.getByRole("group", { name: "Team 1" }));
  const teamTwo = within(screen.getByRole("group", { name: "Team 2" }));
  await user.type(teamOne.getByRole("textbox", { name: "Team name" }), "Short King");
  await user.type(teamTwo.getByRole("textbox", { name: "Team name" }), "Dart Vader");
  await user.click(screen.getByRole("button", { name: "Finish" }));
};

describe("LeaguePage league creation", () => {
  it("opens from create=1 and removes that parameter when canceled", async () => {
    useLeagueApi(emptyOnboarding);
    const user = userEvent.setup();
    renderLeaguePage("/league?create=1&source=empty-state");

    expect(await screen.findByRole("dialog", { name: "Input league info" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close dialog" }));

    expect(screen.queryByRole("dialog", { name: "Input league info" })).not.toBeInTheDocument();
    expect(screen.getByTestId("league-location")).toHaveTextContent("/league?source=empty-state");
  });

  it("refreshes onboarding and opens the created season", async () => {
    let created = false;
    const initialLeague = onboarding({ canManageLeague: true }).leagues[0];
    const createdOnboarding = {
      ...onboarding({ canManageLeague: true }),
      leagues: [{
        ...initialLeague,
        leagueId: "league-new",
        leagueName: "Sunday Games",
        seasonId: "season-new",
      }],
    };
    useLeagueApi(emptyOnboarding, { season: createdSeasonFixture, claimableTeams: [] });
    leagueServer.use(
      http.get("/onboarding", () => HttpResponse.json(created ? createdOnboarding : emptyOnboarding)),
      http.post("/leagues", () => {
        created = true;
        return HttpResponse.json({ season: createdSeasonFixture }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderLeaguePage("/league?create=1");

    await screen.findByRole("dialog", { name: "Input league info" });
    await completeManualLeague(user);

    await waitFor(() => {
      expect(screen.getByTestId("league-location")).toHaveTextContent("/league?seasonId=season-new");
    });
    expect(await screen.findByRole("heading", { name: "Sunday Games" })).toBeVisible();
  });
});
