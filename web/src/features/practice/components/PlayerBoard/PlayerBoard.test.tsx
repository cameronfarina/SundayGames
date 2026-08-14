import { render, screen } from "@testing-library/react";
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
        onToggleTarget={onToggleTarget}
        shortlist={shortlist}
        targetChangesDisabled={false}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "NFL" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Bye" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Market" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "My value" })).toBeInTheDocument();
    expect(screen.getByText("Keeper · $4")).toBeInTheDocument();
    expect(screen.getByText("$70")).toBeInTheDocument();
    expect(screen.getByText("$75")).toBeInTheDocument();

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
        onToggleTarget={vi.fn()}
        shortlist={shortlist}
        targetChangesDisabled={false}
      />,
    );

    await user.type(screen.getByRole("searchbox", { name: "Search players" }), "goff");
    expect(screen.getByText("Jared Goff")).toBeInTheDocument();
    expect(screen.getByText("2", { selector: "td" })).toBeInTheDocument();
    expect(screen.queryByText("Puka Nacua")).not.toBeInTheDocument();
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
    expect(screen.getByText("Keeper", { selector: ".keeper-badge" })).toBeInTheDocument();
    expect(screen.getByText("FA")).toBeInTheDocument();
    view.unmount();
  });

  it("disables target changes when no league is active", () => {
    const view = render(
      <PlayerBoard
        catalog={catalog}
        onToggleTarget={vi.fn()}
        shortlist={[]}
        targetChangesDisabled
      />,
    );

    expect(screen.getByRole("button", { name: "Add Puka Nacua to simulation plan" })).toBeDisabled();
    view.unmount();
  });
});
