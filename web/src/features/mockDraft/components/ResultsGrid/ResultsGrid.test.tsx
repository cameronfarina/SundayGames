import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockResultsSchema } from "../../api/mockDraftSchemas.js";
import { completedMockResponseFixture } from "../../test/completedMockResponseFixture.js";
import { ResultsGrid } from "./ResultsGrid.js";

describe("ResultsGrid", () => {
  it("compares every completed roster and its Week 1 estimate", () => {
    const response = completedMockResponseFixture();
    const results = response.results;
    expect(results).toBeDefined();
    if (results === undefined) return;
    render(<ResultsGrid results={results} />);

    expect(screen.getByRole("heading", { name: "League results" })).toBeInTheDocument();
    expect(screen.getByText("Week 1 estimates available for all 2 rostered players.")).toBeInTheDocument();
    const userTeam = screen.getByRole("article", { name: "1. Short King" });
    expect(within(userTeam).getByText("Your team")).toBeInTheDocument();
    expect(within(userTeam).getByText("16.1")).toBeInTheDocument();
    expect(within(userTeam).getByText("De'Von Achane")).toBeInTheDocument();
    expect(within(userTeam).getByText("Keeper")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "2. Dart Vader" })).toBeInTheDocument();
  });

  it("reports partial projection coverage", () => {
    const response = completedMockResponseFixture();
    const results = response.results;
    expect(results).toBeDefined();
    if (results === undefined) return;
    const partial = mockResultsSchema.parse({ ...results, projectedPlayerCount: 1 });
    render(<ResultsGrid results={partial} />);
    expect(screen.getByText("Week 1 estimates available for 1 of 2 rostered players."))
      .toBeInTheDocument();
  });

  it("handles results without optional prices or budget totals", () => {
    const results = mockResultsSchema.parse({
      projectedPlayerCount: 2,
      rosteredPlayerCount: 2,
      teams: [{
        isUserTeam: false,
        rank: 1,
        roster: [
          {
            playerId: "keeper",
            playerName: "Unpriced Keeper",
            position: "RB",
            rosterSlot: "RB1",
            source: "keeper",
            starter: true,
            week1Points: 10,
          },
          {
            playerId: "selection",
            playerName: "Unpriced Selection",
            position: "WR",
            rosterSlot: "WR1",
            source: "ai",
            starter: true,
            week1Points: 9,
          },
        ],
        teamId: "team-1",
        teamName: "No Totals",
        week1Points: 19,
      }],
    });
    render(<ResultsGrid results={results} />);
    const card = screen.getByRole("article", { name: "1. No Totals" });
    expect(within(card).queryByText(/spent/u)).not.toBeInTheDocument();
    expect(within(card).getAllByText("Keeper")).toHaveLength(2);
    expect(within(card).getByText("-")).toBeInTheDocument();
  });
});
