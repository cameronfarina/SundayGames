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
});
