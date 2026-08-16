import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SimulationHistoryItem } from "../../api/simulationSchema";
import { SimulationWorkspace } from "./SimulationWorkspace";

const history: readonly SimulationHistoryItem[] = [{
  completedAt: "2026-08-13T12:00:00.000Z",
  id: "run-1",
  note: "RB build",
  simulation: {
    completedCount: 25,
    draftFormat: "auction",
    outcomes: [{ favorite: false, rank: 1, runNumber: 8, userWeek1Points: 121.4 }],
    runCount: 25,
    strategy: { preferredPositions: [], rawInput: "", summary: "Balanced", warnings: [] },
  },
}, {
  createdAt: "2026-08-12T12:00:00.000Z",
  id: "run-2",
  simulation: {
    completedCount: 10,
    draftFormat: "snake",
    outcomes: [],
    runCount: 10,
    strategy: { preferredPositions: [], rawInput: "", summary: "WR heavy", warnings: [] },
  },
}, {
  id: "run-3",
  simulation: {
    completedCount: 5,
    draftFormat: "auction",
    outcomes: [],
    runCount: 5,
    strategy: { preferredPositions: [], rawInput: "", summary: "Hero RB", warnings: [] },
  },
}];

describe("SimulationWorkspace", () => {
  it("submits optional rules independently from the saved simulation plan", async () => {
    const user = userEvent.setup();
    const onOpenHistory = vi.fn();
    const onRun = vi.fn();
    const view = render(
      <SimulationWorkspace
        history={history}
        onOpenHistory={onOpenHistory}
        onRun={onRun}
        pending={false}
        progress={undefined}
        teamClaimed
      />,
    );

    expect(screen.getByText("Your saved draft targets stay in the plan. Add only roster-wide rules here; these rules never replace your targets."))
      .toBeInTheDocument();
    await user.clear(screen.getByRole("spinbutton", { name: "Number of simulations" }));
    await user.type(screen.getByRole("spinbutton", { name: "Number of simulations" }), "10");
    await user.type(screen.getByRole("textbox", { name: "Optional roster rules" }), "Do not spend over $25 on another WR");
    await user.type(screen.getByRole("textbox", { name: "Run label" }), "RB value test");
    await user.click(screen.getByRole("button", { name: "Run simulations" }));

    expect(onRun).toHaveBeenCalledWith({
      count: 10,
      note: "RB value test",
      strategy: "Do not spend over $25 on another WR",
    });
    await user.click(screen.getByRole("button", { name: /Open 25-run simulation/u }));
    expect(onOpenHistory).toHaveBeenCalledWith("run-1", 8);
    expect(screen.getAllByText("No label")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /Open 10-run simulation from 2026-08-12/u })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open 5-run simulation from saved history/u })).toBeInTheDocument();
    view.unmount();
  });

  it("shows honest progress and locks simulation without a claimed team", () => {
    const { rerender, unmount } = render(
      <SimulationWorkspace
        history={[]}
        onOpenHistory={vi.fn()}
        onRun={vi.fn()}
        pending
        progress={{ completed: 5, total: 25 }}
        teamClaimed
      />,
    );
    expect(screen.getByRole("progressbar", { name: "Simulation progress" })).toHaveAttribute("value", "5");
    expect(screen.getByText("5 of 25 drafts complete (20%)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Running simulations" })).toBeDisabled();

    rerender(<SimulationWorkspace history={[]} onOpenHistory={vi.fn()} onRun={vi.fn()} pending progress={undefined} teamClaimed />);
    expect(screen.getByText("Preparing league simulations…")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Simulation progress" })).toHaveAttribute("max", "1");

    rerender(<SimulationWorkspace history={[]} onOpenHistory={vi.fn()} onRun={vi.fn()} pending={false} progress={undefined} teamClaimed={false} />);
    expect(screen.getByText("Claim a team before running private league simulations.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run simulations" })).toBeDisabled();
    expect(screen.getByText("No saved simulation runs yet.")).toBeInTheDocument();
    unmount();
  });
});
