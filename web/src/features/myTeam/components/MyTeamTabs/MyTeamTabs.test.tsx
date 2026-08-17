import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { OnboardingLeague } from "../../../../shared/api/onboarding/onboardingSchema";
import { MyTeamTabs } from "./MyTeamTabs";

const league: OnboardingLeague = {
  canManageLeague: false,
  leagueId: "league-1",
  leagueName: "Sunday Games",
  leagueSlug: "sunday-games",
  liveDraft: null,
  membership: { role: "member" },
  readiness: { leagueSetup: "ready", liveDraft: "ready", teamClaim: "ready" },
  seasonId: "season-2026",
  seasonYear: 2026,
};

describe("MyTeamTabs", () => {
  it("preserves the active season and identifies the current view", () => {
    render(<MemoryRouter><MyTeamTabs league={league} view="prep" /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Draft prep" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Player news" })).not.toBeInTheDocument();
  });

  it("builds a clean league link", () => {
    render(<MemoryRouter><MyTeamTabs league={league} view="team" /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Team" })).toHaveAttribute(
      "href",
      "/leagues/sunday-games/my-team?view=team",
    );
  });
});
