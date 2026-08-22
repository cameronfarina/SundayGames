import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { snakeMockResponseFixture } from "../../test/snakeMockResponseFixture.js";
import { SnakeBoard } from "./SnakeBoard.js";

const { state } = snakeMockResponseFixture();

describe("SnakeBoard", () => {
  afterEach(() => { document.body.replaceChildren(); });

  it("lays every round out with its picks and names the drafted players", () => {
    render(<SnakeBoard
      currentOverall={2}
      humanTeamId="team-owner11"
      picks={state.board.picks}
      players={state.board.players}
    />);

    expect(screen.getByText("Round 1")).toBeVisible();
    expect(screen.getByText("Round 2")).toBeVisible();
    expect(screen.getByText("1.01")).toBeVisible();
    expect(screen.getByText("Jahmyr Gibbs")).toBeVisible();
    expect(screen.getByText("On the clock")).toBeVisible();
  });

  it("shows teams across columns and rounds down rows", () => {
    render(<SnakeBoard
      currentOverall={2}
      humanTeamId="team-owner11"
      picks={state.board.picks}
      players={state.board.players}
    />);

    const board = screen.getByRole("table", { name: "Draft board" });
    expect(within(board).getAllByRole("columnheader").map(cell => cell.textContent)).toEqual([
      "Round",
      "Sentinels",
      "Short King",
    ]);

    const roundTwoCells = within(within(board).getByRole("row", { name: /Round 2/ }))
      .getAllByRole("cell");
    expect(roundTwoCells[0]).toHaveTextContent("2.02");
    expect(roundTwoCells[1]).toHaveTextContent("2.01");
  });

  it("falls back to the player id when the board no longer lists the player", () => {
    render(<SnakeBoard
      currentOverall={undefined}
      humanTeamId="team-owner11"
      picks={state.board.picks}
      players={[]}
    />);

    expect(screen.getByText("gibbs")).toBeVisible();
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });

  it("renders an empty board without inventing team columns", () => {
    render(<SnakeBoard
      currentOverall={undefined}
      humanTeamId="team-owner11"
      picks={[]}
      players={[]}
    />);

    expect(screen.getAllByRole("columnheader").map(cell => cell.textContent)).toEqual(["Round"]);
  });

  it("places unexpected later-round teams after the established columns", () => {
    const establishedPick = state.board.picks[0];
    if (establishedPick === undefined) throw new Error("Expected the fixture to include a pick");
    const unexpectedPick = {
      ...establishedPick,
      overall: 2,
      pickInRound: 2,
      round: 2,
      teamId: "late-team",
      teamName: "Late Team",
    };

    render(<SnakeBoard
      currentOverall={undefined}
      humanTeamId="team-owner11"
      picks={[
        establishedPick,
        unexpectedPick,
        { ...establishedPick, overall: 3, round: 2 },
        { ...unexpectedPick, overall: 4, pickInRound: 1, round: 3 },
        { ...establishedPick, overall: 5, pickInRound: 2, round: 3 },
      ]}
      players={state.board.players}
    />);

    expect(screen.getByRole("row", { name: /Round 2/ })).toHaveTextContent("2.02");
    expect(screen.getByRole("row", { name: /Round 3/ })).toHaveTextContent("3.02");
  });
});
