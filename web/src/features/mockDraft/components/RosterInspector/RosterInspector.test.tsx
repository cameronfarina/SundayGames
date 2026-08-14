import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { auctionTeamSchema } from "../../api/auctionBoardSchemas.js";
import { auctionMockResponseFixture } from "../../test/auctionMockResponseFixture.js";
import { RosterInspector } from "./RosterInspector.js";

beforeAll(() => {
  Object.defineProperties(Element.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
    setPointerCapture: { configurable: true, value: () => undefined },
  });
});

describe("RosterInspector", () => {
  it("opens on the user team and inspects every team's budget and roster", async () => {
    const response = auctionMockResponseFixture();
    render(
      <RosterInspector
        humanTeamId="team-cam"
        teams={response.state.teams}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Inspect team roster" }))
      .toHaveTextContent("Short King roster");
    expect(screen.getByText("$150")).toBeInTheDocument();
    expect(screen.getAllByText("$50")).toHaveLength(2);
    expect(screen.getByText("$136")).toBeInTheDocument();
    expect(screen.getByText("De'Von Achane")).toBeInTheDocument();
    expect(screen.getByText("Keeper")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("combobox", { name: "Inspect team roster" }));
    await userEvent.click(screen.getByRole("option", { name: "Dart Vader roster" }));
    expect(screen.getAllByText("$200")).toHaveLength(1);
    expect(screen.getByText("$198")).toBeInTheDocument();
    expect(screen.queryByText("De'Von Achane")).not.toBeInTheDocument();
  });

  it("falls back to the first team when the human team is unavailable", () => {
    const response = auctionMockResponseFixture();
    render(<RosterInspector humanTeamId="missing" teams={response.state.teams} />);
    expect(screen.getByRole("combobox", { name: "Inspect team roster" }))
      .toHaveTextContent("Short King roster");
  });

  it("handles empty teams and incomplete roster slots", () => {
    const { rerender } = render(<RosterInspector humanTeamId="missing" teams={[]} />);
    expect(screen.getByText("No teams available.")).toBeInTheDocument();

    const team = auctionTeamSchema.parse({
      budgetDollars: 200,
      budgetRemaining: 190,
      id: "new-team",
      isHuman: false,
      maxBid: 188,
      name: "New Team",
      positionCounts: { WR: 1 },
      roster: [{
        expectedPrice: 10,
        playerId: "receiver",
        playerName: "Wide Receiver",
        position: "WR",
        price: 10,
        rosterSlot: "WR1",
        source: "ai",
      }],
      rosterSlotsRemaining: 2,
      slots: [
        { eligiblePositions: ["WR"], playerId: "receiver", slot: "WR1" },
        { eligiblePositions: ["RB"], playerId: "missing", slot: "RB1" },
        { eligiblePositions: [], slot: "UTILITY" },
      ],
      spent: 10,
    });
    rerender(<RosterInspector humanTeamId="missing" teams={[team]} />);
    expect(screen.getByText("Wide Receiver")).toBeInTheDocument();
    expect(screen.getAllByText("Open")).toHaveLength(2);
  });

  it("falls back after the selected team leaves the response", async () => {
    const response = auctionMockResponseFixture();
    const { rerender } = render(
      <RosterInspector humanTeamId="team-cam" teams={response.state.teams} />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Inspect team roster" }));
    await userEvent.click(screen.getByRole("option", { name: "Dart Vader roster" }));
    const humanTeam = response.state.teams.find(team => team.id === "team-cam");
    expect(humanTeam).toBeDefined();
    if (humanTeam === undefined) return;
    rerender(<RosterInspector humanTeamId="team-cam" teams={[humanTeam]} />);
    expect(screen.getByRole("combobox", { name: "Inspect team roster" }))
      .toHaveTextContent("Short King roster");
  });
});
