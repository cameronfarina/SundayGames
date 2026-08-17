import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { OnboardingLeague } from "../../../../../shared/api/onboarding/onboardingSchema";
import { usePracticeLocation } from "./usePracticeLocation";

const league: OnboardingLeague = {
  canManageLeague: true,
  leagueId: "league-1",
  leagueName: "Sunday Games",
  leagueSlug: "sunday-games",
  liveDraft: null,
  membership: { role: "owner" },
  readiness: { leagueSetup: "ready", liveDraft: "ready", teamClaim: "ready" },
  seasonId: "season-2026",
  seasonYear: 2026,
};

const LocationProbe = () => {
  const route = usePracticeLocation([league]);
  return <>
    <dl>
      <dt>League</dt><dd>{route.activeLeague?.leagueName}</dd>
      <dt>History</dt><dd>{route.historyId}</dd>
      <dt>Run</dt><dd>{route.selectedRunNumber}</dd>
      <dt>Strategy</dt><dd>{route.strategy}</dd>
    </dl>
    <button onClick={() => { route.changeLeague("missing"); }} type="button">Choose missing league</button>
  </>;
};

describe("usePracticeLocation", () => {
  it("reads the league slug and simulation selection from a clean practice URL", () => {
    render(
      <MemoryRouter initialEntries={[
        "/leagues/sunday-games/practice?runId=history-1&simulationRun=3&strategy=hero-rb",
      ]}>
        <Routes>
          <Route path="/leagues/:leagueSlug/practice" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Sunday Games")).toBeInTheDocument();
    expect(screen.getByText("history-1")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("hero-rb")).toBeInTheDocument();
  });

  it("ignores a league selection that is no longer available", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/leagues/sunday-games/practice"]}>
        <Routes>
          <Route path="/leagues/:leagueSlug/practice" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Choose missing league" }));
    expect(screen.getByText("Sunday Games")).toBeInTheDocument();
  });
});
