import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import type { PracticeSimulation } from "../../api/simulationSchema";
import { SimulationResults } from "./SimulationResults";

beforeAll(() => {
  Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
    setPointerCapture: { configurable: true, value: () => undefined },
  });
});

const roster: PracticeSimulation["runs"][number]["teams"][number]["roster"] = [{
  playerId: "player-1",
  playerName: "De'Von Achane",
  position: "RB",
  price: 50,
  rosterSlot: "RB1",
  source: "keeper",
  starter: true,
  week1Points: 16.1,
}, {
  overallPick: 8,
  playerId: "player-2",
  playerName: "Jared Goff",
  position: "QB",
  rosterSlot: "QB",
  source: "ai",
  starter: false,
  week1Points: 18,
}, {
  playerId: "player-3",
  playerName: "Bench Player",
  position: "WR",
  rosterSlot: "BENCH1",
  source: "human",
  starter: false,
  week1Points: 1,
}];

const simulation: PracticeSimulation = {
  completedCount: 2,
  draftFormat: "auction",
  playerExposure: [{
    averagePrice: 15,
    count: 1,
    playerId: "price",
    playerName: "Jadarian Price",
    position: "RB",
    rate: 0.5,
  }, {
    averagePick: 8,
    count: 1,
    playerId: "goff",
    playerName: "Jared Goff",
    position: "QB",
    rate: 0.5,
  }, {
    count: 1,
    playerId: "bench",
    playerName: "Bench Player",
    position: "WR",
    rate: 0.5,
  }],
  positionCounts: { RB: { perRun: 2, total: 4 } },
  runCount: 2,
  runs: [
    {
      label: "Run 1",
      runNumber: 1,
      seed: "one",
      teams: [
        { budgetRemaining: 0, isUserTeam: true, roster, spent: 200, teamId: "short", teamName: "Short King", week1Points: 106.5 },
        { isUserTeam: false, roster: [], spent: 200, teamId: "seth", teamName: "Sentinels", week1Points: 101.1 },
      ],
    },
    {
      label: "Run 2",
      runNumber: 2,
      seed: "two",
      teams: [{ isUserTeam: true, roster: [], teamId: "short", teamName: "Short King", week1Points: 99.2 }],
    },
  ],
  seedPrefix: "test",
  strategy: {
    preferredPositions: [],
    rawInput: "Draft Jadarian Price",
    summary: "Target Jadarian Price",
    warnings: ["Target cap was restrictive."],
  },
  targetOutcomes: [{ hitCount: 1, hitRate: 0.5, playerId: "price", playerName: "Jadarian Price" }],
};

describe("SimulationResults", () => {
  it("shows summary, exposure, warnings, and every team in a selected run", () => {
    const view = render(<SimulationResults note="Compare builds" simulation={simulation} />);
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.getByText("50% Jadarian Price")).toBeInTheDocument();
    expect(screen.getByText("Target cap was restrictive.")).toBeInTheDocument();
    expect(screen.getByText("Compare builds")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Short King" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sentinels" })).toBeInTheDocument();
    expect(screen.getByText("Keeper")).toBeInTheDocument();
    expect(screen.getAllByText("50%", { selector: "td" })).toHaveLength(3);
    expect(screen.getByText("Pick 8.0")).toBeInTheDocument();
    expect(screen.getByText("-", { selector: ".simulation-results__exposure td" })).toBeInTheDocument();
    view.unmount();
  });
  it("navigates between individual league outcomes", async () => {
    const user = userEvent.setup();
    const { rerender, unmount } = render(<SimulationResults note="" simulation={simulation} />);
    await user.click(screen.getByRole("combobox", { name: "Simulation run" }));
    await user.click(screen.getByRole("option", { name: "Run 2" }));
    expect(screen.getByText("99.2")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sentinels" })).not.toBeInTheDocument();
    rerender(<SimulationResults note="" simulation={{ ...simulation, runs: simulation.runs.slice(0, 1) }} />);
    expect(screen.getByText("106.5")).toBeInTheDocument();
    unmount();
  });
  it("handles simulations without named targets or roster results", () => {
    const view = render(<SimulationResults note={undefined} simulation={{
      ...simulation,
      draftFormat: "snake",
      runs: [],
      strategy: { ...simulation.strategy, warnings: [] },
      targetOutcome: { hitCount: 1, hitRate: 0.25, playerId: "price", playerName: "Jadarian Price" },
      targetOutcomes: undefined,
    }} />);

    expect(screen.getByText("25% Jadarian Price")).toBeInTheDocument();
    expect(screen.getByText("Snake")).toBeInTheDocument();
    expect(screen.getByText("No roster results were returned.")).toBeInTheDocument();
    expect(screen.queryByText("Run note")).not.toBeInTheDocument();
    view.unmount();
  });

  it("handles simulation results without any target outcome", () => {
    const view = render(<SimulationResults note="" simulation={{
      ...simulation,
      runs: [],
      targetOutcome: undefined,
      targetOutcomes: undefined,
    }} />);
    expect(screen.getByText("No named targets")).toBeInTheDocument();
    view.unmount();
  });
});
