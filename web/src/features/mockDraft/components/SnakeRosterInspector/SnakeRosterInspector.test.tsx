import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { snakeMockResponseFixture } from "../../test/snakeMockResponseFixture.js";
import { SnakeRosterInspector } from "./SnakeRosterInspector.js";

const { state } = snakeMockResponseFixture();

describe("SnakeRosterInspector", () => {
  afterEach(() => { document.body.replaceChildren(); });

  it("opens on the manager's own team and marks the open slots", () => {
    render(<SnakeRosterInspector
      humanTeamId="team-owner11"
      players={state.board.players}
      teams={state.teams}
    />);

    expect(screen.getByRole("region", { name: "Short King roster" })).toBeVisible();
    expect(screen.getAllByText("Open")).toHaveLength(2);
  });

  it("names the drafted player in the slot that holds it", () => {
    render(<SnakeRosterInspector
      humanTeamId="team-owner04"
      players={state.board.players}
      teams={state.teams}
    />);

    expect(screen.getByText("Jahmyr Gibbs")).toBeVisible();
  });

  it("marks a keeper and falls back when the board no longer lists the player", () => {
    render(<SnakeRosterInspector
      humanTeamId="team-kept"
      players={[]}
      teams={[{
        id: "team-kept",
        name: "Keepers",
        roster: [{ playerId: "achane", rosterSlot: "RB1", source: "keeper" }],
        slots: [
          { eligiblePositions: [], playerId: "achane", slot: "RB1" },
          { eligiblePositions: [], slot: "BENCH1" },
        ],
      }]}
    />);

    expect(screen.getByText("Keeper")).toBeVisible();
    expect(screen.getByText("achane")).toBeVisible();
    expect(screen.getByText("Open")).toBeVisible();
  });

  it("explains an empty league instead of rendering an empty list", () => {
    render(<SnakeRosterInspector humanTeamId="team-owner11" players={[]} teams={[]} />);

    expect(screen.getByText("No teams available.")).toBeVisible();
  });
});
