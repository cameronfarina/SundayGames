import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { TeamRoster } from "./TeamRoster";
import { liveRoom, liveTeam } from "../../test/liveDraftFixtures";

beforeAll(() => {
  Object.defineProperties(Element.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
    setPointerCapture: { configurable: true, value: () => undefined },
  });
});

describe("TeamRoster", () => {
  it("shows the selected roster, keepers, and auction limits", async () => {
    const user = userEvent.setup();
    const onTeamChange = vi.fn();
    render(<TeamRoster
      onTeamChange={onTeamChange}
      selectedTeamId="team-1"
      teams={liveRoom.teamSummaries}
    />);

    expect(screen.getByRole("heading", { name: "Short King roster" })).toBeVisible();
    expect(screen.getByText("Budget left")).toHaveTextContent("Budget left$150");
    expect(screen.getByText("Spent")).toHaveTextContent("Spent$50");
    expect(screen.getByText("Max bid")).toHaveTextContent("Max bid$150");
    expect(screen.getByText(/Keeper/)).toBeVisible();
    expect(screen.getByText("Open")).toBeVisible();
    expect(screen.getByText("RB1")).toHaveClass("team-roster__slot", "position--rb");
    expect(screen.getByText("WR1")).toHaveClass("team-roster__slot", "position--wr");

    await user.click(screen.getByRole("combobox", { name: "View team" }));
    await user.click(screen.getByRole("option", { name: "2. Sentinels · Owner04" }));
    expect(onTeamChange).toHaveBeenCalledWith("team-2");
  });

  it("shows an empty state when no teams exist", () => {
    render(<TeamRoster onTeamChange={vi.fn()} teams={[]} />);
    expect(screen.getByText("No team rosters are available.")).toBeVisible();
  });

  it("does not label drafted players as keepers", () => {
    render(<TeamRoster
      onTeamChange={vi.fn()}
      teams={[{
        ...liveTeam,
        slots: [{
          slot: "WR1",
          player: {
            expectedPrice: 72,
            name: "Puka Nacua",
            normalizedPlayerName: "puka nacua",
            position: "WR",
            price: 62,
            source: "sale",
          },
        }],
      }]}
    />);

    expect(screen.getByText("$62")).toBeVisible();
    expect(screen.queryByText(/Keeper/)).not.toBeInTheDocument();
  });

  it("keeps bench labels and values in separate layout columns", () => {
    render(<TeamRoster
      onTeamChange={vi.fn()}
      teams={[{
        ...liveTeam,
        slots: [{ slot: "BENCH1" }],
      }]}
    />);

    expect(screen.getByText("BENCH1")).toHaveClass("team-roster__slot", "position--bench");
    expect(screen.getByRole("listitem")).toHaveClass("team-roster__slot-row");
    expect(screen.getByText("Open")).toHaveClass("team-roster__open");
  });
});
