import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PracticePlayer } from "../../api/playerCatalogSchema";
import { PlayerBoardRow } from "./PlayerBoardRow";

const player: PracticePlayer = {
  byeWeek: 6,
  expectedPrice: 57,
  marketPrice: 60,
  leagueValue: 62,
  myValue: 65,
  name: "Jahmyr Gibbs",
  position: "RB",
  teamAbbreviation: "DET",
};

describe("PlayerBoardRow", () => {
  it("renders values and adds a player to the simulation plan", async () => {
    const user = userEvent.setup();
    const onToggleTarget = vi.fn();
    const onSaveMyValue = vi.fn();
    render(<table><tbody><PlayerBoardRow
      isTarget={false}
      onSaveMyValue={onSaveMyValue}
      onToggleTarget={onToggleTarget}
      player={player}
      rank={1}
      targetChangesDisabled={false}
    /></tbody></table>);
    expect(screen.getByText("$60")).toBeVisible();
    expect(screen.getByText("$62")).toBeVisible();
    const myValue = screen.getByRole("spinbutton", { name: "My value for Jahmyr Gibbs" });
    expect(myValue).toHaveValue(65);
    await user.clear(myValue);
    await user.type(myValue, "70{Enter}");
    expect(onSaveMyValue).toHaveBeenCalledWith(player, 70);
    await user.click(screen.getByRole("button", { name: "Add Jahmyr Gibbs to simulation plan" }));
    expect(onToggleTarget).toHaveBeenCalledWith(player);
  });

  it("labels removal and missing NFL context accurately", () => {
    render(<table><tbody><PlayerBoardRow
      isTarget
      onSaveMyValue={vi.fn()}
      onToggleTarget={vi.fn()}
      player={{ ...player, byeWeek: undefined, teamAbbreviation: undefined }}
      rank={2}
      targetChangesDisabled
    /></tbody></table>);
    expect(screen.getByRole("button", { name: "Remove Jahmyr Gibbs from simulation plan" })).toBeDisabled();
    expect(screen.getAllByText("-")).toHaveLength(1);
    expect(screen.getByText("FA")).toBeVisible();
  });

  it("cancels an edited personal value with Escape", async () => {
    const user = userEvent.setup();
    const onSaveMyValue = vi.fn();
    render(<table><tbody><PlayerBoardRow
      isTarget={false}
      onSaveMyValue={onSaveMyValue}
      onToggleTarget={vi.fn()}
      player={player}
      rank={1}
      targetChangesDisabled={false}
    /></tbody></table>);
    const myValue = screen.getByRole("spinbutton", { name: "My value for Jahmyr Gibbs" });
    await user.clear(myValue);
    await user.type(myValue, "70{Escape}");
    expect(myValue).toHaveValue(65);
    await user.tab();
    expect(onSaveMyValue).not.toHaveBeenCalled();
  });

  it("restores an invalid personal value instead of saving it", async () => {
    const user = userEvent.setup();
    const onSaveMyValue = vi.fn();
    render(<table><tbody><PlayerBoardRow
      isTarget={false}
      onSaveMyValue={onSaveMyValue}
      onToggleTarget={vi.fn()}
      player={player}
      rank={1}
      targetChangesDisabled={false}
    /></tbody></table>);
    const myValue = screen.getByRole("spinbutton", { name: "My value for Jahmyr Gibbs" });

    await user.clear(myValue);
    await user.type(myValue, "0");
    await user.tab();

    expect(myValue).toHaveValue(65);
    expect(onSaveMyValue).not.toHaveBeenCalled();
  });
});
