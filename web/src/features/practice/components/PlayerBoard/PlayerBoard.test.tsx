import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PlayerCatalog } from "../../api/playerCatalogSchema";
import type { PracticeShortlistItem } from "../../api/practiceContextSchema";
import { PlayerBoard } from "./PlayerBoard";
beforeAll(() => {
  Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
    setPointerCapture: { configurable: true, value: () => undefined },
  });
});
const catalog: PlayerCatalog = {
  draftFormat: "auction",
  personalized: true,
  strategyLabel: "balanced",
  players: [
    {
      byeWeek: 11,
      expectedPrice: 73,
      leagueValue: 72,
      marketPrice: 70,
      myValue: 75,
      name: "Puka Nacua",
      position: "WR",
      teamAbbreviation: "LAR",
    },
    {
      expectedPrice: 7,
      isKeeper: true,
      keeperPrice: 4,
      name: "Jared Goff",
      position: "QB",
      teamAbbreviation: "DET",
    },
    {
      expectedPrice: 2,
      isKeeper: true,
      marketRank: 2,
      name: "Brock Bowers",
      position: "TE",
    },
  ],
};
const shortlist: readonly PracticeShortlistItem[] = [{
  createdAt: "2026-08-13T12:00:00.000Z",
  id: "target-1",
  leagueId: "league-1",
  playerName: "Puka Nacua",
  position: "WR",
  priority: 1,
  seasonId: "season-1",
  updatedAt: "2026-08-13T12:00:00.000Z",
  userId: "user-1",
}];

describe("PlayerBoard", () => {
  it("shows the complete pricing board and toggles targets", async () => {
    const user = userEvent.setup();
    const onToggleTarget = vi.fn();
    const view = render(
      <PlayerBoard
        catalog={catalog}
        onSaveMyValue={vi.fn()}
        onToggleTarget={onToggleTarget}
        shortlist={shortlist}
        targetChangesDisabled={false}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "NFL" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Bye" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Market" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Simulation" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "My value" })).toBeInTheDocument();
    expect(screen.queryByText("Jared Goff")).not.toBeInTheDocument();
    expect(screen.queryByText("Brock Bowers")).not.toBeInTheDocument();
    expect(screen.getByText("1 shown / 1 matching / 3 loaded")).toBeInTheDocument();
    expect(screen.getByText("$70")).toBeInTheDocument();
    expect(screen.getByText("$72")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "My value for Puka Nacua" })).toHaveValue(75);

    const targetButton = screen.getByRole("button", { name: "Remove Puka Nacua from simulation plan" });
    expect(targetButton).toHaveAttribute("title", "Remove Puka Nacua from simulation plan");
    expect(screen.getByText("Remove Puka Nacua from simulation plan")).toHaveAttribute("aria-hidden", "true");
    await user.click(targetButton);
    expect(onToggleTarget).toHaveBeenCalledWith(catalog.players[0]);
    view.unmount();
  });

  it("searches, filters positions, and limits the view to targets", async () => {
    const user = userEvent.setup();
    const view = render(
      <PlayerBoard
        catalog={catalog}
        onSaveMyValue={vi.fn()}
        onToggleTarget={vi.fn()}
        shortlist={shortlist}
        targetChangesDisabled={false}
      />,
    );

    const search = screen.getByRole("searchbox", { name: "Search players" });
    expect(search).toHaveAttribute("placeholder", "Search players, position or NFL team");
    await user.type(search, "goff");
    expect(screen.queryByText("Jared Goff")).not.toBeInTheDocument();
    expect(screen.getByText("No players match these filters.")).toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "Search players" }));
    await user.click(screen.getByRole("button", { name: "WR" }));
    expect(screen.getByText("Puka Nacua")).toBeInTheDocument();
    expect(screen.queryByText("Jared Goff")).not.toBeInTheDocument();
    const targetFilter = screen.getByRole("checkbox", { name: /Draft targets only/u });
    expect(targetFilter).not.toBeChecked();
    await user.click(targetFilter);
    expect(targetFilter).toBeChecked();
    expect(screen.getByText("Puka Nacua")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "RB" }));
    expect(screen.getByText("No players match these filters.")).toBeInTheDocument();
    view.unmount();
  });

  it("sorts by each board value without replacing page navigation", async () => {
    const user = userEvent.setup();
    const view = render(<PlayerBoard
      catalog={catalog}
      onSaveMyValue={vi.fn()}
      onToggleTarget={vi.fn()}
      shortlist={shortlist}
      targetChangesDisabled={false}
    />);

    const select = screen.getByRole("combobox", { name: "Sort players" });
    await user.click(select);
    await user.click(screen.getByRole("option", { name: "My value" }));
    await user.click(select);
    await user.click(screen.getByRole("option", { name: "Rank" }));
    await user.click(select);
    await user.click(screen.getByRole("option", { name: "Market value" }));
    expect(screen.getByText("Puka Nacua")).toBeInTheDocument();
    expect(screen.queryByText("Jared Goff")).not.toBeInTheDocument();
    expect(screen.queryByText("Brock Bowers")).not.toBeInTheDocument();
    view.unmount();
  });

  it("starts in true market-rank order even when dollar values disagree", () => {
    const view = render(<PlayerBoard
      catalog={{
        players: [
          { expectedPrice: 52, marketPrice: 52, marketRank: 8, name: "Amon-Ra St. Brown", position: "WR" },
          { expectedPrice: 52, marketPrice: 52, marketRank: 7, name: "Jonathan Taylor", position: "RB" },
          { expectedPrice: 55, marketPrice: 55, marketRank: 4, name: "Puka Nacua", position: "WR" },
        ],
      }}
      onSaveMyValue={vi.fn()}
      onToggleTarget={vi.fn()}
      shortlist={[]}
      targetChangesDisabled={false}
    />);

    const names = within(screen.getByRole("table")).getAllByRole("row")
      .slice(1)
      .map(row => within(row).getAllByRole("cell")[2]?.textContent);
    expect(names).toEqual(["Puka Nacua", "Jonathan Taylor", "Amon-Ra St. Brown"]);
    expect(screen.getByRole("combobox", { name: "Sort players" })).toHaveTextContent("Rank");
    view.unmount();
  });

  it("disables target changes when no league is active", () => {
    const view = render(
      <PlayerBoard
        catalog={catalog}
        onSaveMyValue={vi.fn()}
        onToggleTarget={vi.fn()}
        shortlist={[]}
        targetChangesDisabled
      />,
    );

    expect(screen.getByRole("button", { name: "Add Puka Nacua to simulation plan" })).toBeDisabled();
    view.unmount();
  });
});
