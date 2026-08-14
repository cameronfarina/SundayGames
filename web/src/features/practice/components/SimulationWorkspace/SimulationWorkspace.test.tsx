import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PracticeShortlistItem } from "../../api/practiceContextSchema";
import type { SimulationHistoryItem } from "../../api/simulationSchema";
import { SimulationWorkspace } from "./SimulationWorkspace";

const target: PracticeShortlistItem = {
  createdAt: "2026-08-13T12:00:00.000Z",
  id: "target-1",
  leagueId: "league-1",
  maxBid: 15,
  playerName: "Jadarian Price",
  position: "RB",
  priority: 1,
  seasonId: "season-1",
  updatedAt: "2026-08-13T12:00:00.000Z",
  userId: "user-1",
};

const history: readonly SimulationHistoryItem[] = [{
  completedAt: "2026-08-13T12:00:00.000Z",
  id: "run-1",
  note: "RB build",
  simulation: {
    completedCount: 25,
    draftFormat: "auction",
    runCount: 25,
    strategy: { preferredPositions: [], rawInput: "", summary: "Balanced", warnings: [] },
  },
}, {
  createdAt: "2026-08-12T12:00:00.000Z",
  id: "run-2",
  simulation: {
    completedCount: 10,
    draftFormat: "snake",
    runCount: 10,
    strategy: { preferredPositions: [], rawInput: "", summary: "WR heavy", warnings: [] },
  },
}, {
  id: "run-3",
  simulation: {
    completedCount: 5,
    draftFormat: "auction",
    runCount: 5,
    strategy: { preferredPositions: [], rawInput: "", summary: "Hero RB", warnings: [] },
  },
}];

describe("SimulationWorkspace", () => {
  it("submits targets, instructions, count, and a useful run label", async () => {
    const user = userEvent.setup();
    const onOpenHistory = vi.fn();
    const onRun = vi.fn();
    const view = render(
      <SimulationWorkspace
        history={history}
        onOpenHistory={onOpenHistory}
        onRun={onRun}
        pending={false}
        shortlist={[target]}
        teamClaimed
      />,
    );

    await user.clear(screen.getByRole("spinbutton", { name: "Number of simulations" }));
    await user.type(screen.getByRole("spinbutton", { name: "Number of simulations" }), "10");
    await user.type(screen.getByRole("textbox", { name: "Additional draft instructions" }), "Prioritize Week 1 scoring");
    await user.type(screen.getByRole("textbox", { name: "Run label" }), "RB value test");
    await user.click(screen.getByRole("button", { name: "Run simulations" }));

    expect(onRun).toHaveBeenCalledWith({
      count: 10,
      note: "RB value test",
      strategy: "Draft Jadarian Price for no more than $15. Prioritize Week 1 scoring.",
    });
    await user.click(screen.getByRole("button", { name: /Open 25-run simulation/u }));
    expect(onOpenHistory).toHaveBeenCalledWith("run-1");
    expect(screen.getAllByText("No label")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /Open 10-run simulation from 2026-08-12/u })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open 5-run simulation from saved history/u })).toBeInTheDocument();
    view.unmount();
  });

  it("shows honest progress and locks simulation without a claimed team", () => {
    const { rerender, unmount } = render(
      <SimulationWorkspace history={[]} onOpenHistory={vi.fn()} onRun={vi.fn()} pending shortlist={[]} teamClaimed />,
    );
    expect(screen.getByRole("progressbar", { name: "Simulation progress" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Running simulations" })).toBeDisabled();

    rerender(<SimulationWorkspace history={[]} onOpenHistory={vi.fn()} onRun={vi.fn()} pending={false} shortlist={[]} teamClaimed={false} />);
    expect(screen.getByText("Claim a team before running private league simulations.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run simulations" })).toBeDisabled();
    expect(screen.getByText("No saved simulation runs yet.")).toBeInTheDocument();
    unmount();
  });
});
