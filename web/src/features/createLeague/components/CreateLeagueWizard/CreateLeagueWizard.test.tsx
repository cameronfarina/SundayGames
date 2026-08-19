import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, delay, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { onboardingQueryKey } from "../../../../shared/api/onboarding/onboardingQuery";
import { createdSeasonFixture } from "../../test/createdSeasonFixture";
import { importedReviewFixture } from "../../test/importedReviewFixture";
import { renderCreateLeagueWizard } from "../../test/renderCreateLeagueWizard";

const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => { server.resetHandlers(); });
afterAll(() => { server.close(); });

const completeBasics = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByRole("textbox", { name: "League name" }), "Sunday Games");
  const teamCount = screen.getByRole("spinbutton", { name: "Number of teams" });
  fireEvent.change(teamCount, {
    target: { value: "2" },
  });
  screen.getByRole("button", { name: "Next" }).focus();
  await user.keyboard("{Enter}");
};

const reachTeamsManually = async (user: ReturnType<typeof userEvent.setup>) => {
  await completeBasics(user);
  await user.click(screen.getByRole("button", { name: "Enter settings manually" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
};

describe("CreateLeagueWizard", () => {
  it("validates basics and supports Enter, Back, Escape, and sticky navigation", async () => {
    const user = userEvent.setup();
    const { onClose } = renderCreateLeagueWizard();

    expect(screen.getByRole("dialog", { name: "Input league info" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a league name.");

    await completeBasics(user);
    expect(screen.getByRole("heading", { name: "Reference league" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("textbox", { name: "League name" })).toHaveValue("Sunday Games");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("jumps to any visited step from the progress tabs", async () => {
    const user = userEvent.setup();
    renderCreateLeagueWizard();
    const progress = screen.getByRole("list", { name: "League setup progress" });

    expect(within(progress).queryByRole("button")).not.toBeInTheDocument();
    await completeBasics(user);
    expect(within(progress).queryByRole("button", { name: "Scoring" })).not.toBeInTheDocument();
    await user.click(within(progress).getByRole("button", { name: "Basics" }));
    expect(screen.getByRole("heading", { name: "League basics" })).toBeVisible();
    await user.click(within(progress).getByRole("button", { name: "Reference" }));
    expect(screen.getByRole("heading", { name: "Reference league" })).toBeVisible();
  });

  it("creates a manual league only after every team name is present", async () => {
    let postedBody: unknown;
    server.use(http.post("/leagues", async ({ request }) => {
      postedBody = await request.json();
      await delay(40);
      return HttpResponse.json({ season: createdSeasonFixture }, { status: 201 });
    }));
    const user = userEvent.setup();
    const { onCreated, queryClient } = renderCreateLeagueWizard();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    await reachTeamsManually(user);
    expect(screen.getByText("0 of 2 team names entered")).toBeVisible();
    expect(screen.getByRole("button", { name: "Finish" })).toBeDisabled();
    const teamOne = within(screen.getByRole("group", { name: "Team 1" }));
    const teamTwo = within(screen.getByRole("group", { name: "Team 2" }));
    await user.type(teamOne.getByRole("textbox", { name: "Team name" }), "Short King");
    await user.type(teamOne.getByRole("textbox", { name: "Managers" }), "Owner11, Manager11");
    await user.type(teamOne.getByRole("textbox", { name: "Abbreviation" }), "OWN11");
    expect(screen.getByRole("button", { name: "Finish" })).toBeDisabled();
    await user.type(teamTwo.getByRole("textbox", { name: "Team name" }), "Dart Vader");
    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(screen.getByRole("button", { name: "Creating league" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Finish" })).toBeEnabled();
    expect(postedBody).toMatchObject({ setup: {
      provider: "mockd",
      expectedTeamCount: 2,
      teams: [
        { displayName: "Short King", managerNames: ["Owner11", "Manager11"], abbreviation: "OWN11" },
        { displayName: "Dart Vader" },
      ],
    } });
    expect(onCreated).toHaveBeenCalledWith("season-new");
    expect(invalidateQueries).toHaveBeenCalledExactlyOnceWith({
      queryKey: onboardingQueryKey(),
    });
  });

  it("requires explicit review before applying ESPN settings", async () => {
    server.use(http.post("/league-imports/espn/review", () => HttpResponse.json(importedReviewFixture)));
    const user = userEvent.setup();
    renderCreateLeagueWizard();
    await completeBasics(user);
    await user.type(screen.getByRole("textbox", { name: "ESPN league ID or URL" }), "100001");
    await user.click(screen.getByRole("button", { name: "Review ESPN settings" }));

    const review = await screen.findByRole("region", { name: "Imported ESPN settings" });
    expect(review).toHaveTextContent("The League");
    expect(review).toHaveTextContent("2 teams");
    expect(review).toHaveTextContent("$200 auction");
    expect(review).toHaveTextContent("0.5 points per reception");
    expect(review).toHaveTextContent("QB 1");
    expect(review).toHaveTextContent("Short King");
    expect(review).toHaveTextContent("minimum bid");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Use imported settings" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("spinbutton", { name: "Points per reception" })).toHaveValue(0.5);
  });

  it("starts with a clean draft every time the dialog opens", async () => {
    const user = userEvent.setup();
    const { setOpen } = renderCreateLeagueWizard();
    await user.type(screen.getByRole("textbox", { name: "League name" }), "Temporary League");

    setOpen(false);
    expect(screen.queryByRole("dialog", { name: "Input league info" })).not.toBeInTheDocument();
    setOpen(true);

    expect(screen.getByRole("textbox", { name: "League name" })).toHaveValue("");
    expect(screen.getByRole("heading", { name: "League basics" })).toBeVisible();
  });
});
