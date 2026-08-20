import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ProductTour } from "./ProductTour";

describe("ProductTour", () => {
  it("opens on the league, where a visitor actually starts", () => {
    render(<ProductTour />);

    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("League");
    expect(screen.getByRole("img")).toHaveAccessibleName(/connections screen/u);
  });

  it("shows one screen at a time, so only that screen loads", () => {
    render(<ProductTour />);

    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("changes the screen when a visitor picks another stop", async () => {
    render(<ProductTour />);

    await userEvent.click(screen.getByRole("tab", { name: "Simulations" }));

    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Simulations");
    expect(screen.getByRole("img")).toHaveAccessibleName(/Simulation results/u);
  });

  it("names every stop on the way through the product", () => {
    render(<ProductTour />);

    expect(screen.getAllByRole("tab").map(tab => tab.textContent))
      .toEqual(["League", "Values", "Simulations", "Plan", "Draft room"]);
  });
});
