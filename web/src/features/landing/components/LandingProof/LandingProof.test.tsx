import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingProof } from "./LandingProof";

describe("LandingProof", () => {
  it("shows the same three prices the board above it shows", () => {
    render(<LandingProof />);

    expect(screen.getByText("$56")).toBeVisible();
    expect(screen.getByText("$65")).toBeVisible();
    expect(screen.getByText("$67")).toBeVisible();
  });

  it("names the three prices the board puts side by side", () => {
    render(<LandingProof />);

    expect(screen.getByText(/The market’s price\. Your league’s price\. Your price\./u))
      .toBeVisible();
  });

  it("claims only the platforms and formats the product supports", () => {
    render(<LandingProof />);

    expect(screen.getAllByRole("listitem").map(item => item.textContent)).toEqual([
      "Sleeper and ESPN leagues",
      "Snake and auction drafts",
      "Keeper-aware pricing",
    ]);
  });
});
