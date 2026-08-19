import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { connectionDetailFixture } from "../../api/leagueDetail.fixture";
import { MatchupTable } from "./MatchupTable";

const league = connectionDetailFixture.league;

describe("MatchupTable", () => {
  it("names both teams and shows a bye with no opponent", () => {
    if (league === null) throw new Error("Expected a league fixture.");
    render(<MatchupTable matchups={league.matchups} teams={league.teams} />);

    expect(screen.getByText("Giant Dolphins · 148.04")).toBeVisible();
    expect(screen.getByText("Team 2 · 101.50")).toBeVisible();
    expect(screen.getByText("Bye")).toBeVisible();
  });

  it("falls back to a team number when the roster is not in the snapshot", () => {
    if (league === null) throw new Error("Expected a league fixture.");
    render(<MatchupTable matchups={league.matchups} teams={[]} />);

    expect(screen.getByText("Team 1 · 148.04")).toBeVisible();
  });

  it("says no games have been scored instead of showing an empty table", () => {
    render(<MatchupTable matchups={[]} teams={[]} />);

    expect(screen.getByText("No games have been scored in this league yet.")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
