import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { AccountDashboardLeague } from "../../api/accountDashboardSchema";
import { LeagueDashboardCard } from "./LeagueDashboardCard";

const league: AccountDashboardLeague = {
  draft: { roomId: "room-1", status: "ended" },
  draftFormat: "snake",
  leagueId: "league-1",
  leagueName: "Office League",
  leagueSlug: "office-league",
  membershipRole: "observer",
  metrics: { completedMocks: 1, historicalImportSeasons: 1, savedSimulationOutcomes: 1, simulationRuns: 1, simulationsCompleted: 1 },
  provider: "yahoo",
  readiness: { leagueSetup: "ready", liveDraft: "ready", teamClaim: "needs_attention" },
  seasonId: "season-1",
  seasonStatus: "locked",
  seasonYear: 2026,
  teamCount: 1,
};

describe("LeagueDashboardCard", () => {
  it("does not offer entry for an ended room or invent a claimed team", () => {
    render(<MemoryRouter><LeagueDashboardCard league={league} /></MemoryRouter>);

    expect(screen.getByText(/No team claimed/u)).toBeVisible();
    expect(screen.getByText("Snake · 1 team")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Enter draft" })).not.toBeInTheDocument();
    expect(screen.getByText("Mocks completed (24h)")).toBeVisible();
    expect(screen.getByText("Simulation batches (latest 25)")).toBeVisible();
    expect(screen.getByText("Saved outcomes (latest 25)")).toBeVisible();
  });
});
