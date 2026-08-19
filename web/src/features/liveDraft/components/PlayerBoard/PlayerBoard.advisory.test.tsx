import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlayerBoard } from "./PlayerBoard";
import { liveAdvisory, liveRoom } from "../../test/liveDraftFixtures";

describe("PlayerBoard FantasyPros overlay", () => {
  it("leaves the board exactly as it was when FantasyPros is dark", () => {
    render(<PlayerBoard
      canManage={false}
      onUsePlayer={vi.fn()}
      players={liveRoom.board}
      roomIsLive
    />);

    expect(screen.queryByRole("columnheader", { name: "FP rank" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Data by FantasyPros/u)).not.toBeInTheDocument();
  });

  it("leaves the board alone when the advisory matched nobody", () => {
    render(<PlayerBoard
      advisory={{ configured: true, basis: "ros", week: 4, players: [] }}
      canManage={false}
      onUsePlayer={vi.fn()}
      players={liveRoom.board}
      roomIsLive
    />);

    expect(screen.queryByRole("columnheader", { name: "FP rank" })).not.toBeInTheDocument();
  });

  it("adds a FantasyPros rank column and attribution when the overlay is active", () => {
    render(<PlayerBoard
      advisory={liveAdvisory}
      canManage={false}
      onUsePlayer={vi.fn()}
      players={liveRoom.board}
      roomIsLive
    />);

    expect(screen.getByRole("columnheader", { name: "FP rank" })).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /Puka Nacua/u });
    expect(within(row).getByText("3")).toBeInTheDocument();
    expect(within(row).getByText("consensus rank up 4")).toBeInTheDocument();
    expect(screen.getByText(/Data by FantasyPros/u)).toHaveTextContent("rest-of-season ranks");
  });

  it("shows a placeholder for a board player FantasyPros does not rank", () => {
    render(<PlayerBoard
      advisory={liveAdvisory}
      canManage={false}
      onUsePlayer={vi.fn()}
      players={[
        ...liveRoom.board,
        {
          byeWeek: 9,
          expectedPrice: 4,
          name: "Unranked Rookie",
          normalizedPlayerName: "unranked rookie",
          position: "WR",
          teamAbbreviation: "SEA",
        },
      ]}
      roomIsLive
    />);

    const row = screen.getByRole("row", { name: /Unranked Rookie/u });
    expect(within(row).getByText("--")).toBeInTheDocument();
  });

  it("keeps the price columns last so bidding controls stay put", () => {
    render(<PlayerBoard
      advisory={liveAdvisory}
      canManage={false}
      onUsePlayer={vi.fn()}
      players={liveRoom.board}
      roomIsLive
    />);

    const headers = screen.getAllByRole("columnheader").map(header => header.textContent);
    expect(headers).toEqual(["Player", "Pos", "NFL", "Bye", "FP rank", "Market", "Our value"]);
  });
});
