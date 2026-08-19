import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { connectionDetailFixture } from "../../api/leagueDetail.fixture";
import { TeamRoster } from "./TeamRoster";

const teams = connectionDetailFixture.league?.teams ?? [];
const withPlayers = teams.at(0);
const empty = teams.at(1);

describe("TeamRoster", () => {
  it("shows owners, record, and each player's slot and status", () => {
    if (withPlayers === undefined) throw new Error("Expected a team fixture.");
    render(<TeamRoster team={withPlayers} />);

    expect(screen.getByRole("heading", { name: "Giant Dolphins" })).toBeVisible();
    expect(screen.getByText("2KSports, feiyingx")).toBeVisible();
    expect(screen.getByText("7-6 · 1776.06 PF")).toBeVisible();
    expect(screen.getByText("RB · NO")).toBeVisible();
    expect(screen.getByText("QUESTIONABLE")).toBeVisible();
    expect(screen.getByText("BN")).toBeVisible();
  });

  it("says a team is empty instead of rendering a blank list", () => {
    if (empty === undefined) throw new Error("Expected an empty team fixture.");
    render(<TeamRoster team={empty} />);

    expect(screen.getByText("This team has no players yet.")).toBeVisible();
    expect(screen.queryByText("2KSports, feiyingx")).not.toBeInTheDocument();
    expect(screen.getByText("6-7-1 · 1500.00 PF")).toBeVisible();
  });
});
