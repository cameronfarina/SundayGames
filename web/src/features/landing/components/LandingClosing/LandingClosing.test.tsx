import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandingClosing } from "./LandingClosing";

describe("LandingClosing", () => {
  it("closes on the same action the page opened with", () => {
    render(<MemoryRouter><LandingClosing /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "Connect my league" }))
      .toHaveAttribute("href", "/signup");
  });
});
