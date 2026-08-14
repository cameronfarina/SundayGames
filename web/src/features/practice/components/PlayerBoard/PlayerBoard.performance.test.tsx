import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PlayerCatalog } from "../../api/playerCatalogSchema";
import type { PracticeShortlistItem } from "../../api/practiceContextSchema";
import { PlayerBoard } from "./PlayerBoard";

const catalog: PlayerCatalog = {
  draftFormat: "auction",
  personalized: false,
  strategyLabel: "baseline",
  players: Array.from({ length: 500 }, (_, index) => {
    const number = index + 1;
    return {
      expectedPrice: 501 - number,
      name: `Player ${String(number).padStart(3, "0")}`,
      position: index % 2 === 0 ? "QB" : "RB",
    };
  }),
};

const shortlist: readonly PracticeShortlistItem[] = [{
  createdAt: "2026-08-13T12:00:00.000Z",
  id: "target-500",
  leagueId: "league-1",
  playerName: "Player 500",
  position: "RB",
  priority: 1,
  seasonId: "season-1",
  updatedAt: "2026-08-13T12:00:00.000Z",
  userId: "user-1",
}];

describe("PlayerBoard performance", () => {
  it("bounds the initial rows and lets users reveal the complete catalog", async () => {
    const user = userEvent.setup();
    render(<PlayerBoard catalog={catalog} onToggleTarget={vi.fn()} shortlist={[]} targetChangesDisabled={false} />);

    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(51);
    expect(screen.getByText("50 shown / 500 matching / 500 loaded")).toBeInTheDocument();
    for (let visiblePlayers = 50; visiblePlayers < catalog.players.length; visiblePlayers += 50) {
      await user.click(screen.getByRole("button", { name: /Show .* more players/u }));
    }
    expect(screen.getByText("Player 500")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(501);
    expect(screen.queryByRole("button", { name: /Show .* more players/u })).not.toBeInTheDocument();
  });

  it("resets expanded rows when search and position filters change", async () => {
    const user = userEvent.setup();
    render(<PlayerBoard catalog={catalog} onToggleTarget={vi.fn()} shortlist={[]} targetChangesDisabled={false} />);

    await user.click(screen.getByRole("button", { name: /Show .* more players/u }));
    await user.click(screen.getByRole("button", { name: /Show .* more players/u }));
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(151);

    await user.type(screen.getByRole("searchbox", { name: "Search players" }), "Player 1");
    await waitFor(() => {
      expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(51);
    });

    await user.clear(screen.getByRole("searchbox", { name: "Search players" }));
    await user.click(screen.getByRole("button", { name: "QB" }));
    await waitFor(() => {
      expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(51);
    });
  });

  it("finds and toggles a late shortlisted player with its catalog rank", async () => {
    const user = userEvent.setup();
    const onToggleTarget = vi.fn();
    render(<PlayerBoard
      catalog={catalog}
      onToggleTarget={onToggleTarget}
      shortlist={shortlist}
      targetChangesDisabled={false}
    />);

    expect(screen.queryByText("Player 500")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Draft targets only/u }));
    const playerRow = screen.getByRole("row", { name: /Player 500/u });
    expect(within(playerRow).getByText("500", { selector: "td" })).toBeInTheDocument();
    expect(screen.getByText("1 shown / 1 matching / 500 loaded")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Player 500 from draft targets" }));
    expect(onToggleTarget).toHaveBeenCalledWith(catalog.players[499]);
  });
});
