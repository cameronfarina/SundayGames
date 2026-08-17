import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PositionFilters } from "./PositionFilters";

const buttonNames = () => screen.getAllByRole("button").map(button => button.textContent);

describe("PositionFilters", () => {
  it("offers the flex button when a league starts a flexible slot", () => {
    const view = render(<PositionFilters
      flexPositions={["RB", "WR", "TE"]}
      onSelect={vi.fn()}
      selected="ALL"
    />);

    expect(buttonNames()).toEqual(["All", "QB", "RB", "WR", "TE", "FLEX", "DST", "K"]);
    view.unmount();
  });

  it("leaves the flex button out when a league starts none", () => {
    const view = render(<PositionFilters flexPositions={[]} onSelect={vi.fn()} selected="ALL" />);

    expect(buttonNames()).toEqual(["All", "QB", "RB", "WR", "TE", "DST", "K"]);
    view.unmount();
  });

  it("marks the chosen position and reports a new choice", async () => {
    const onSelect = vi.fn();
    const view = render(<PositionFilters
      flexPositions={["RB", "WR", "TE"]}
      onSelect={onSelect}
      selected="WR"
    />);

    expect(screen.getByRole("button", { name: "WR" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "QB" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.setup().click(screen.getByRole("button", { name: "FLEX" }));
    expect(onSelect).toHaveBeenCalledWith("FLEX");
    view.unmount();
  });
});
