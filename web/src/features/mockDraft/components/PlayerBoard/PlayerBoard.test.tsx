import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { auctionPlayerSchema } from "../../api/auctionBoardSchemas.js";
import { auctionMockResponseFixture } from "../../test/auctionMockResponseFixture.js";
import { PlayerBoard } from "./PlayerBoard.js";

describe("PlayerBoard", () => {
  it("shows league values and filters the board without losing controls", async () => {
    const response = auctionMockResponseFixture();
    const onNominate = vi.fn();
    render(
      <PlayerBoard
        canNominate
        humanTeam={response.state.teams[0]}
        onNominate={onNominate}
        players={response.state.board.players}
      />,
    );

    const table = screen.getByRole("table", { name: "Available players" });
    expect(within(table).getByRole("columnheader", { name: "Market value" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Our value" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "NFL" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Bye" })).toBeInTheDocument();
    expect(within(table).getByText("$76")).toBeInTheDocument();
    expect(within(table).getByText("$81")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "WR" }));
    expect(screen.queryByText("Jahmyr Gibbs")).not.toBeInTheDocument();
    expect(screen.getByText("Puka Nacua")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "FLEX" }));
    expect(screen.getByText("Jahmyr Gibbs")).toBeInTheDocument();

    await userEvent.type(screen.getByRole("searchbox", { name: "Search available players" }), "LAR");
    expect(screen.queryByText("Jahmyr Gibbs")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Nominate Puka Nacua" }));
    expect(onNominate).toHaveBeenCalledWith("puka");
  });

  it("marks positions and disables nominations that cannot fit", () => {
    const response = auctionMockResponseFixture();
    render(
      <PlayerBoard
        canNominate={false}
        humanTeam={response.state.teams[0]}
        onNominate={vi.fn()}
        players={response.state.board.players}
      />,
    );

    const table = screen.getByRole("table", { name: "Available players" });
    expect(within(table).getByText("RB")).toHaveClass("position--rb");
    expect(within(table).getByText("WR")).toHaveClass("position--wr");
    expect(screen.getByRole("button", { name: "Nominate Puka Nacua" })).toBeDisabled();
  });

  it("falls back cleanly when player metadata and a compatible roster are unavailable", async () => {
    const players = auctionPlayerSchema.array().parse([{
      available: true,
      expectedPrice: 9.6,
      id: "quarterback",
      name: "Starting Quarterback",
      position: "QB",
      status: "available",
    }]);
    render(
      <PlayerBoard
        canNominate
        humanTeam={undefined}
        onNominate={vi.fn()}
        players={players}
      />,
    );

    const row = screen.getByRole("row", { name: /Starting Quarterback/u });
    expect(within(row).getAllByText("$10")).toHaveLength(2);
    expect(within(row).getAllByText("-")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Nominate Starting Quarterback" })).toBeDisabled();

    await userEvent.type(screen.getByRole("searchbox"), "missing");
    expect(screen.getByText("No available players match these filters.")).toBeInTheDocument();
  });
});
