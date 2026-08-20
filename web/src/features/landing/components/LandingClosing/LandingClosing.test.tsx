import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandingClosing } from "./LandingClosing";

describe("LandingClosing", () => {
  it("closes with the same action the page opened with", () => {
    render(<MemoryRouter><LandingClosing /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "Start free" })).toHaveAttribute("href", "/signup");
  });

  it("says plainly what the product will not do to a connected league", () => {
    render(<MemoryRouter><LandingClosing /></MemoryRouter>);

    expect(screen.getByText(/never sets a lineup or makes a move for you/u)).toBeVisible();
  });
});
