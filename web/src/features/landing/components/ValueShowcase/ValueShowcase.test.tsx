import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ValueShowcase } from "./ValueShowcase";

describe("ValueShowcase", () => {
  it("puts the board itself at the centre of the page", () => {
    render(<ValueShowcase />);

    expect(screen.getByRole("heading", { level: 2 }))
      .toHaveTextContent("See what players are worth here.");
    expect(screen.getByRole("row", { name: /Jahmyr Gibbs/u })).toBeVisible();
  });

  it("says who settles the price", () => {
    render(<ValueShowcase />);

    expect(screen.getByText(/Your league sets the price/u)).toBeVisible();
  });
});
