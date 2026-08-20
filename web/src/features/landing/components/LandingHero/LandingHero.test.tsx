import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandingHero } from "./LandingHero";

describe("LandingHero", () => {
  it("leads with the premise and one action", () => {
    render(<MemoryRouter><LandingHero /></MemoryRouter>);

    expect(screen.getByRole("heading", { level: 1 }))
      .toHaveTextContent("Your league isn’t average.So why is your draft prep?");
    expect(screen.getByRole("link", { name: "Connect my league" }))
      .toHaveAttribute("href", "/signup");
  });

  it("says up front that the product only reads a league", () => {
    render(<MemoryRouter><LandingHero /></MemoryRouter>);

    expect(screen.getByText(/never changes your lineup, roster or league/u)).toBeVisible();
  });

  it("shows a real board with the callout pointing at one row", () => {
    render(<MemoryRouter><LandingHero /></MemoryRouter>);

    const row = screen.getByRole("row", { name: /Jahmyr Gibbs/u });

    expect(row).toHaveClass("board-preview__row--focused");
    expect(screen.getByText("Connected to Sunday Funday")).toBeVisible();
  });
});
