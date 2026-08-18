import { render, screen } from "@testing-library/react";
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
