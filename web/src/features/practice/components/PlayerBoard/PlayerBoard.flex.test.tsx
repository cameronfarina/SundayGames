import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PlayerCatalog } from "../../api/playerCatalogSchema";
import { PlayerBoard } from "./PlayerBoard";

const players: PlayerCatalog["players"] = [
  { expectedPrice: 55, marketRank: 1, name: "Puka Nacua", position: "WR" },
  { expectedPrice: 50, marketRank: 2, name: "Jonathan Taylor", position: "RB" },
  { expectedPrice: 30, marketRank: 3, name: "Brock Bowers", position: "TE" },
  { expectedPrice: 25, marketRank: 4, name: "Josh Allen", position: "QB" },
  { expectedPrice: 2, marketRank: 5, name: "Chris Boswell", position: "K" },
];

const renderWithFlex = (flexPositions: readonly string[] | undefined) => render(<PlayerBoard
  catalog={{ players, ...(flexPositions === undefined ? {} : { flexPositions: [...flexPositions] }) }}
  onSaveMyValue={vi.fn()}
  onToggleTarget={vi.fn()}
  shortlist={[]}
  targetChangesDisabled={false}
/>);

const shownNames = () => screen.getAllByRole("row")
  .slice(1)
  .map(row => row.textContent);

describe("PlayerBoard flex filter", () => {
  it("shows the positions a standard flex accepts", async () => {
    const view = renderWithFlex(["RB", "WR", "TE"]);

    await userEvent.setup().click(screen.getByRole("button", { name: "FLEX" }));

    const names = shownNames().join(" ");
    expect(names).toContain("Puka Nacua");
    expect(names).toContain("Jonathan Taylor");
    expect(names).toContain("Brock Bowers");
    expect(names).not.toContain("Josh Allen");
    expect(names).not.toContain("Chris Boswell");
    view.unmount();
  });

  it("adds the quarterback in a superflex league", async () => {
    const view = renderWithFlex(["QB", "RB", "WR", "TE"]);

    await userEvent.setup().click(screen.getByRole("button", { name: "FLEX" }));

    expect(shownNames().join(" ")).toContain("Josh Allen");
    view.unmount();
  });

  it("hides the flex button when a league starts no flexible slot", () => {
    const view = renderWithFlex([]);

    expect(screen.queryByRole("button", { name: "FLEX" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "QB" })).toBeVisible();
    view.unmount();
  });

  it("hides the flex button when the league sends no flex positions at all", () => {
    const view = renderWithFlex(undefined);

    expect(screen.queryByRole("button", { name: "FLEX" })).not.toBeInTheDocument();
    view.unmount();
  });
});
