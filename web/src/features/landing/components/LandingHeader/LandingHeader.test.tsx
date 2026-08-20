import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandingHeader } from "./LandingHeader";

describe("LandingHeader", () => {
  it("offers a way in for people with an account and people without one", () => {
    render(<MemoryRouter><LandingHeader /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Start free" })).toHaveAttribute("href", "/signup");
  });

  it("points at the two sections that explain the product", () => {
    render(<MemoryRouter><LandingHeader /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "How it works" }))
      .toHaveAttribute("href", "#how-it-works");
    expect(screen.getByRole("link", { name: "Product tour" }))
      .toHaveAttribute("href", "#product-tour");
  });
});
