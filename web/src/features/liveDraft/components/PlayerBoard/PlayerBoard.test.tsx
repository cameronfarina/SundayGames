import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlayerBoard } from "./PlayerBoard";
import { liveRoom } from "../../test/liveDraftFixtures";

describe("PlayerBoard", () => {
  it("orders available players by displayed market value", () => {
    render(<PlayerBoard
      canManage={false}
      onUsePlayer={vi.fn()}
      players={[
        {
          expectedPrice: 79,
          marketPrice: 73,
          name: "Bijan Robinson",
          normalizedPlayerName: "bijan robinson",
          position: "RB",
        },
        {
          expectedPrice: 80,
          marketPrice: 74,
          name: "Ja'Marr Chase",
          normalizedPlayerName: "jamar chase",
          position: "WR",
        },
        {
          expectedPrice: 68,
          marketPrice: 63,
          name: "Jonathan Taylor",
          normalizedPlayerName: "jonathan taylor",
          position: "RB",
        },
        {
          expectedPrice: 69,
          marketPrice: 64,
          name: "Amon-Ra St. Brown",
          normalizedPlayerName: "amonra st brown",
          position: "WR",
        },
      ]}
      roomIsLive
    />);

    expect(screen.getAllByRole("rowheader").map(cell => cell.textContent)).toEqual([
      "Ja'Marr Chase",
      "Bijan Robinson",
      "Amon-Ra St. Brown",
      "Jonathan Taylor",
    ]);
  });

  it("shows searchable market and Mockd values with player context", async () => {
    const user = userEvent.setup();
    const onUsePlayer = vi.fn();
    render(<PlayerBoard
      canManage
      onUsePlayer={onUsePlayer}
      players={liveRoom.board}
      roomIsLive
    />);

    expect(screen.getByRole("columnheader", { name: "Market" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Our value" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "$68" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "$72" })).toBeVisible();
    expect(screen.getByText("LAR")).toBeVisible();
    expect(screen.getByText("8")).toBeVisible();
    expect(screen.getByText("WR", { selector: ".position--wr" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Use Puka Nacua in sale command" }));
    expect(onUsePlayer).toHaveBeenCalledWith(liveRoom.board[0]);

    await user.click(screen.getByRole("button", { name: "RB" }));
    expect(screen.getByText("No available players match these filters.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "All" }));
    await user.type(screen.getByRole("searchbox", { name: "Search available players" }), "missing");
    expect(screen.getByText("No available players match these filters.")).toBeVisible();
  });

  it("hides commissioner actions from members", () => {
    render(<PlayerBoard
      canManage={false}
      onUsePlayer={vi.fn()}
      players={liveRoom.board}
      roomIsLive
    />);
    expect(screen.queryByRole("button", { name: /Use Puka/ })).not.toBeInTheDocument();
  });

  it("uses clear fallbacks when optional market context is unavailable", () => {
    render(<PlayerBoard
      canManage={false}
      onUsePlayer={vi.fn()}
      players={[{
        expectedPrice: 7,
        name: "Free Agent",
        normalizedPlayerName: "free agent",
        position: "RB",
      }]}
      roomIsLive={false}
    />);

    expect(screen.getByRole("cell", { name: "FA" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "--" })).toBeVisible();
    expect(screen.getAllByRole("cell", { name: "$7" })).toHaveLength(2);
  });
});
