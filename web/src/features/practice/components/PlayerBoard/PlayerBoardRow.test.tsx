import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PracticePlayer } from "../../api/playerCatalogSchema";
import { PlayerBoardRow } from "./PlayerBoardRow";

const player: PracticePlayer = {
  byeWeek: 6,
  expectedPrice: 57,
  isKeeper: true,
  keeperPrice: 12,
  marketPrice: 60,
  myValue: 65,
  name: "Jahmyr Gibbs",
  position: "RB",
  teamAbbreviation: "DET",
};

describe("PlayerBoardRow", () => {
  it("renders values and adds a player to the simulation plan", async () => {
    const user = userEvent.setup();
    const onToggleTarget = vi.fn();
    render(<table><tbody><PlayerBoardRow
      isTarget={false}
      onToggleTarget={onToggleTarget}
      player={player}
      rank={1}
      targetChangesDisabled={false}
    /></tbody></table>);
    expect(screen.getByText("Keeper · $12")).toBeVisible();
    expect(screen.getByText("$60")).toBeVisible();
    expect(screen.getByText("$65")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add Jahmyr Gibbs to simulation plan" }));
    expect(onToggleTarget).toHaveBeenCalledWith(player);
  });

  it("labels removal and missing NFL context accurately", () => {
    render(<table><tbody><PlayerBoardRow
      isTarget
      onToggleTarget={vi.fn()}
      player={{ ...player, byeWeek: undefined, isKeeper: false, keeperPrice: undefined, teamAbbreviation: undefined }}
      rank={2}
      targetChangesDisabled
    /></tbody></table>);
    expect(screen.getByRole("button", { name: "Remove Jahmyr Gibbs from simulation plan" })).toBeDisabled();
    expect(screen.getAllByText("-")).toHaveLength(1);
    expect(screen.getByText("FA")).toBeVisible();
  });
});
