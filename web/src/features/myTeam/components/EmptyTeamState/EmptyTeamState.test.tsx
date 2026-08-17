import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { onboardingLeagueSchema } from "../../../../shared/api/onboarding/onboardingSchema";
import { EmptyTeamState } from "./EmptyTeamState";

const LocationOutput = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
};

describe("EmptyTeamState", () => {
  it("routes league creation through the application", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/my-team"]}>
      <EmptyTeamState />
      <LocationOutput />
    </MemoryRouter>);

    const createLeague = screen.getByRole("link", { name: "Create league" });
    expect(createLeague).toHaveAttribute("href", "/league?create=1");
    await user.click(createLeague);
    expect(screen.getByTestId("location")).toHaveTextContent("/league?create=1");
  });

  it("routes invitation joining through the application", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/my-team"]}>
      <EmptyTeamState />
      <LocationOutput />
    </MemoryRouter>);

    const joinLeague = screen.getByRole("link", { name: "Join a league" });
    expect(joinLeague).toHaveAttribute("href", "/invite");
    await user.click(joinLeague);
    expect(screen.getByTestId("location")).toHaveTextContent("/invite");
  });

  it("preserves the team claim fragment destination", () => {
    const league = onboardingLeagueSchema.parse({
      canManageLeague: false,
      leagueId: "league-1",
      leagueName: "Sunday Games",
      leagueSlug: "sunday-games",
      liveDraft: null,
      membership: { role: "member" },
      readiness: { leagueSetup: "ready", liveDraft: "ready", teamClaim: "needs_attention" },
      seasonId: "season 1",
      seasonYear: 2026,
    });
    render(<MemoryRouter><EmptyTeamState league={league} /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "Choose team" })).toHaveAttribute(
      "href",
      "/leagues/sunday-games#claim-your-team",
    );
  });
});
