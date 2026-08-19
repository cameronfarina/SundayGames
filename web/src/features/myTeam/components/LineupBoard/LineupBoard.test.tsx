import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { inSeasonTeam } from "../../api/inSeason.fixture";
import { LineupBoard } from "./LineupBoard";

describe("LineupBoard", () => {
  it("names the week, the basis, and every starter", () => {
    render(<LineupBoard team={inSeasonTeam} />);

    expect(screen.getByText("Week 3")).toBeVisible();
    expect(screen.getByText("Ordered by this week's FantasyPros projection.")).toBeVisible();
    expect(screen.getByRole("rowheader", { name: "RB1" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "Jahmyr Gibbs RB" })).toBeVisible();
    expect(screen.getByText(/^Data by FantasyPros · Synced /u)).toBeVisible();
  });

  it("explains why the consensus disagrees with a projected starter", () => {
    render(<LineupBoard team={inSeasonTeam} />);

    expect(screen.getByText(
      "FantasyPros ranks Xavier Legette 3 spots ahead of Cade Otton in this week's consensus.",
    )).toBeVisible();
  });

  it("says so plainly when a slot has no bench option and no points edge", () => {
    render(<LineupBoard team={{
      ...inSeasonTeam,
      lineup: {
        basis: "weekly_projection",
        slots: [{
          slot: "QB",
          eligiblePositions: ["QB"],
          start: inSeasonTeam.players[0] ?? { playerId: "x", playerName: "x", position: "QB" },
        }],
      },
    }} />);

    expect(screen.getByRole("cell", { name: "No bench option" })).toBeVisible();
    expect(screen.getByText("The FantasyPros consensus agrees with every projected starter."))
      .toBeVisible();
  });

  it("labels rest-of-season points when no weekly projection drove the lineup", () => {
    render(<LineupBoard team={{
      ...inSeasonTeam,
      lineup: { basis: "rest_of_season_projection", slots: inSeasonTeam.lineup?.slots ?? [] },
    }} />);

    expect(screen.getByRole("columnheader", { name: "Rest-of-season points" })).toBeVisible();
    expect(screen.getByText("Ordered by rest-of-season FantasyPros projection.")).toBeVisible();
  });

  it("admits when FantasyPros published no projections at all", () => {
    render(<LineupBoard team={{ ...inSeasonTeam, lineup: undefined, week: undefined }} />);

    expect(screen.getByText("FantasyPros has not published projections for your roster yet."))
      .toBeVisible();
  });

  it("admits when FantasyPros is not connected", () => {
    render(<LineupBoard team={{ ...inSeasonTeam, configured: false, lineup: undefined }} />);

    expect(screen.getByText("FantasyPros is not connected, so there are no rankings to compare."))
      .toBeVisible();
  });

  it("falls back to a neutral week label when the week is unknown", () => {
    render(<LineupBoard team={{ ...inSeasonTeam, week: undefined }} />);

    expect(screen.getByText("This week")).toBeVisible();
  });
});
