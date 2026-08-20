import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandingPage } from "./LandingPage";

describe("LandingPage", () => {
  it("tells the story in the order a visitor reads it", () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);

    expect(screen.getAllByRole("heading", { level: 2 }).map(heading => heading.textContent))
      .toEqual([
        "Generic rankings don’t know your league.",
        "See what players are worth here.",
        "Your opponents aren’t random. Your mocks shouldn’t be.",
        "Know your move before you need it.",
        "From league history to the final pick.",
        "One player. Three different prices.",
      ]);
  });

  it("asks for the same one thing at the top and at the bottom", () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);

    expect(screen.getAllByRole("link").map(action => action.textContent))
      .toEqual(["Connect my league", "Connect my league"]);
  });

  it("never claims a platform the product cannot read", () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);

    expect(screen.queryByText(/Yahoo/u)).toBeNull();
  });
});
