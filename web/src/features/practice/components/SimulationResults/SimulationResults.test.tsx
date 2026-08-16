import { render, screen, within } from "@testing-library/react";
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
      onFavoriteChange={vi.fn()}
      onRunChange={vi.fn()}
      pendingFavorite={false}
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
      onFavoriteChange={vi.fn()}
      onRunChange={onRunChange}
      pendingFavorite={false}
      pendingRun={false}
      run={firstRun}
      selectedRunNumber={1}
      summary={summary}
    />);
    await user.click(screen.getByRole("combobox", { name: "Simulation outcome" }));
    await user.click(screen.getByRole("option", { name: "#2 Run 2 · 99.2 pts" }));
    expect(onRunChange).toHaveBeenCalledWith(2);
    rerender(<SimulationResults
      note=""
      onFavoriteChange={vi.fn()}
      onRunChange={onRunChange}
      pendingFavorite={false}
      pendingRun
      run={undefined}
      selectedRunNumber={2}
      summary={summary}
    />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading Run 2");
    rerender(<SimulationResults
      note=""
      onFavoriteChange={vi.fn()}
      onRunChange={onRunChange}
      pendingFavorite={false}
      pendingRun={false}
      run={secondRun}
      selectedRunNumber={2}
      summary={summary}
    />);
    expect(screen.getByText("99.2")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sentinels" })).not.toBeInTheDocument();
    unmount();
  });
  it("saves the selected ranked outcome to My Team", async () => {
    const user = userEvent.setup();
    const onFavoriteChange = vi.fn();
    const view = render(<SimulationResults
      note=""
      onFavoriteChange={onFavoriteChange}
      onRunChange={vi.fn()}
      pendingFavorite={false}
      pendingRun={false}
      run={firstRun}
      selectedRunNumber={1}
      summary={summary}
    />);

    expect(screen.getByRole("combobox", { name: "Simulation outcome" }))
      .toHaveTextContent("#1 Run 1 · 106.5 pts");
    await user.click(screen.getByRole("button", { name: "Save Run 1 to My Team" }));
    expect(onFavoriteChange).toHaveBeenCalledWith(true);
    view.unmount();
  });
  it("renders a legacy singular target outcome and missing roster results", () => {
    const view = render(<SimulationResults note={undefined} onFavoriteChange={vi.fn()} onRunChange={vi.fn()} pendingFavorite={false} pendingRun={false} run={undefined} selectedRunNumber={1} summary={{
      ...summary,
      draftFormat: "snake",
      strategy: { ...summary.strategy, warnings: [] },
      targetOutcome: { hitCount: 1, hitRate: 0.25, playerId: "price", playerName: "Jadarian Price" },
      targetOutcomes: undefined,
    }} />);

    const targetOutcome = screen.getByRole("group", { name: "25% Jadarian Price" });
    expect(within(targetOutcome).queryByText(/^(?:Hit|Miss|Unavailable)$/u))
      .not.toBeInTheDocument();
    expect(screen.getByText("Snake")).toBeInTheDocument();
    expect(screen.getByText("No roster results were returned.")).toBeInTheDocument();
    expect(screen.queryByText("Run note")).not.toBeInTheDocument();
    view.unmount();
  });

  it("handles simulation results without any target outcome", () => {
    const view = render(<SimulationResults note="" onFavoriteChange={vi.fn()} onRunChange={vi.fn()} pendingFavorite={false} pendingRun={false} run={undefined} selectedRunNumber={1} summary={{
      ...summary,
      targetOutcome: undefined,
      targetOutcomes: undefined,
    }} />);
    expect(screen.getByText("No named targets")).toBeInTheDocument();
    view.unmount();
  });
});
