import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { snakeMockResponseFixture } from "../../test/snakeMockResponseFixture.js";
import { SnakePlayerBoard } from "./SnakePlayerBoard.js";

const { state } = snakeMockResponseFixture();
const humanTeam = state.teams.find(team => team.id === "team-owner11");

describe("SnakePlayerBoard", () => {
  afterEach(() => { document.body.replaceChildren(); });

  it("drafts the player the manager picks", async () => {
    const onPick = vi.fn();
    render(<SnakePlayerBoard
      canPick
      humanTeam={humanTeam}
      onPick={onPick}
      players={state.board.players}
    />);

    await userEvent.click(screen.getByRole("button", { name: "Draft Ja'Marr Chase" }));

    expect(onPick).toHaveBeenCalledWith("chase");
  });

  it("narrows the list by search and by position", async () => {
    render(<SnakePlayerBoard
      canPick
      humanTeam={humanTeam}
      onPick={vi.fn()}
      players={state.board.players}
    />);

    await userEvent.type(screen.getByLabelText("Search available players"), "chase");
    expect(screen.queryByRole("button", { name: "Draft Jahmyr Gibbs" })).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Search available players"));
    await userEvent.click(screen.getByRole("button", { name: "QB" }));
    expect(screen.getByText("No available players match these filters.")).toBeVisible();
  });

  it("dashes the fields a catalog player can leave empty", () => {
    const [first] = state.board.players;
    if (first === undefined) throw new Error("Expected a fixture player.");
    render(<SnakePlayerBoard
      canPick
      humanTeam={humanTeam}
      onPick={vi.fn()}
      players={[{
        ...first,
        byeWeek: undefined,
        personalRank: undefined,
        teamAbbreviation: undefined,
      }]}
    />);

    expect(screen.getAllByText("-")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Draft Jahmyr Gibbs" })).toBeVisible();
  });

  it("disables drafting when the manager is not on the clock", () => {
    render(<SnakePlayerBoard
      canPick={false}
      humanTeam={humanTeam}
      onPick={vi.fn()}
      players={state.board.players}
    />);

    expect(screen.getByRole("button", { name: "Draft Ja'Marr Chase" })).toBeDisabled();
  });
});
