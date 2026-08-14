import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SimulationResults } from "./SimulationResults";
import { firstRun, secondRun, summary } from "./SimulationResults.testSupport";

beforeAll(() => {
  Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
    setPointerCapture: { configurable: true, value: () => undefined },
  });
});

describe("SimulationResults", () => {
  it("shows summary, exposure, warnings, and every team in a selected run", () => {
    const view = render(<SimulationResults
      note="Compare builds"
      onRunChange={vi.fn()}
      pendingRun={false}
      run={firstRun}
      selectedRunNumber={1}
      summary={summary}
    />);
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
    const onRunChange = vi.fn();
    const { rerender, unmount } = render(<SimulationResults
      note=""
      onRunChange={onRunChange}
      pendingRun={false}
      run={firstRun}
      selectedRunNumber={1}
      summary={summary}
    />);
    await user.click(screen.getByRole("combobox", { name: "Simulation run" }));
    await user.click(screen.getByRole("option", { name: "Run 2" }));
    expect(onRunChange).toHaveBeenCalledWith(2);
    rerender(<SimulationResults
      note=""
      onRunChange={onRunChange}
      pendingRun
      run={undefined}
      selectedRunNumber={2}
      summary={summary}
    />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading Run 2");
    rerender(<SimulationResults
      note=""
      onRunChange={onRunChange}
      pendingRun={false}
      run={secondRun}
      selectedRunNumber={2}
      summary={summary}
    />);
    expect(screen.getByText("99.2")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sentinels" })).not.toBeInTheDocument();
    unmount();
  });
  it("handles simulations without named targets or roster results", () => {
    const view = render(<SimulationResults note={undefined} onRunChange={vi.fn()} pendingRun={false} run={undefined} selectedRunNumber={1} summary={{
      ...summary,
      draftFormat: "snake",
      strategy: { ...summary.strategy, warnings: [] },
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
    const view = render(<SimulationResults note="" onRunChange={vi.fn()} pendingRun={false} run={undefined} selectedRunNumber={1} summary={{
      ...summary,
      targetOutcome: undefined,
      targetOutcomes: undefined,
    }} />);
    expect(screen.getByText("No named targets")).toBeInTheDocument();
    view.unmount();
  });
});
