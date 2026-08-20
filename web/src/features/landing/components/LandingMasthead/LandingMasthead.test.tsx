import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandingMasthead } from "./LandingMasthead";

describe("LandingMasthead", () => {
  it("leads with the promise and one way to act on it", () => {
    render(<MemoryRouter><LandingMasthead /></MemoryRouter>);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Win your draft before it starts.");
    expect(screen.getByRole("link", { name: "Start free" })).toHaveAttribute("href", "/signup");
  });

  it("leaves the backdrop out of the accessibility tree", () => {
    render(<MemoryRouter><LandingMasthead /></MemoryRouter>);

    expect(screen.queryAllByRole("img")).toEqual([]);
  });
});
