import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandingPage } from "./LandingPage";

describe("LandingPage", () => {
  it("tells the story in the order a visitor reads it", () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);

    expect(screen.getAllByRole("heading", { level: 2 }).map(heading => heading.textContent))
      .toEqual([
        "Argue with the market.",
        "Feel the panic first.",
        "Decide your ceiling while you are calm.",
        "See it before you sign up.",
        "Your draft is coming. Be ready for it.",
      ]);
  });

  it("repeats one call to action rather than competing for the click", () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);

    const actions = screen.getAllByRole("link");

    expect(actions.map(action => action.textContent)).toEqual(["Start free", "Start free"]);
  });
});
