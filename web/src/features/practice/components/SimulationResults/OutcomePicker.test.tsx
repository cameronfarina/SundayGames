import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { summary } from "./SimulationResults.testSupport";
import { OutcomePicker } from "./OutcomePicker";

describe("OutcomePicker", () => {
  it("labels ranked outcomes and saves the selected result", async () => {
    const user = userEvent.setup();
    const onFavoriteChange = vi.fn();
    render(<OutcomePicker
      onFavoriteChange={onFavoriteChange}
      onRunChange={vi.fn()}
      pendingFavorite={false}
      selectedRunNumber={1}
      summary={summary}
    />);
    expect(screen.getByText("#1 Run 1 · 106.5 pts")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save Run 1 to My Team" }));
    expect(onFavoriteChange).toHaveBeenCalledWith(true);
  });

  it("supports legacy outcomes and hides save when no result metadata exists", () => {
    render(<OutcomePicker
      onFavoriteChange={vi.fn()}
      onRunChange={vi.fn()}
      pendingFavorite={false}
      selectedRunNumber={2}
      summary={{ ...summary, outcomes: [] }}
    />);
    expect(screen.getByText("Run 2")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("labels and removes an outcome already saved to My Team", async () => {
    const user = userEvent.setup();
    const onFavoriteChange = vi.fn();
    render(<OutcomePicker
      onFavoriteChange={onFavoriteChange}
      onRunChange={vi.fn()}
      pendingFavorite={false}
      selectedRunNumber={2}
      summary={{
        ...summary,
        outcomes: summary.outcomes.map(outcome => ({
          ...outcome,
          favorite: outcome.runNumber === 2,
        })),
      }}
    />);
    expect(screen.getByText("#2 Run 2 · 99.2 pts · Saved")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Remove Run 2 from My Team" }));
    expect(onFavoriteChange).toHaveBeenCalledWith(false);
  });
});
