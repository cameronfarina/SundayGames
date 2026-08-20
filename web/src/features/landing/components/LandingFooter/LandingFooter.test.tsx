import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandingFooter } from "./LandingFooter";

describe("LandingFooter", () => {
  it("repeats both ways into the product", () => {
    render(<MemoryRouter><LandingFooter /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup");
  });
});
