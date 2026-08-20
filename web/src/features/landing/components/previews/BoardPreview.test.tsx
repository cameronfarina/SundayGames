import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BoardPreview } from "./BoardPreview";

describe("BoardPreview", () => {
  it("shows the market price, the simulated price, and the viewer's own price", () => {
    render(<BoardPreview />);

    const row = screen.getByRole("row", { name: /Jahmyr Gibbs/u });
    const cells = within(row).getAllByRole("cell").map(cell => cell.textContent);

    expect(cells).toEqual(["", "1", "Jahmyr Gibbs", "RB", "$57", "$61", "$64"]);
  });

  it("draws the eye to the prices the viewer moved off the market", () => {
    render(<BoardPreview />);

    const moved = screen.getByRole("row", { name: /Jahmyr Gibbs/u });
    const untouched = screen.getByRole("row", { name: /Bijan Robinson/u });

    expect(within(moved).getByText("64")).toHaveClass("board-preview__value--mine");
    expect(within(untouched).getByText("58")).not.toHaveClass("board-preview__value--mine");
  });

  it("shows every position filter and says which one is on", () => {
    render(<BoardPreview />);

    expect(screen.getAllByRole("listitem").map(item => item.textContent))
      .toEqual(["All", "QB", "RB", "WR", "TE", "DST", "K"]);
    expect(screen.getByRole("listitem", { current: true })).toHaveTextContent("All");
  });
});
