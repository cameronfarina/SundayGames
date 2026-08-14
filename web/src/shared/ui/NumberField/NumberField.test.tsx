import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NumberField } from "./NumberField.js";

describe("NumberField", () => {
  it("renders numeric constraints with accessible supporting copy", () => {
    const { unmount } = render(
      <NumberField
        id="budget"
        label="Auction budget"
        hint="Whole dollars"
        min={1}
        max={500}
        step={1}
      />,
    );

    const input = screen.getByRole("spinbutton", { name: "Auction budget" });
    expect(input).toHaveAttribute("min", "1");
    expect(input).toHaveAttribute("max", "500");
    expect(input).toHaveAttribute("step", "1");
    expect(input).toHaveAccessibleDescription("Whole dollars");
    unmount();
  });

  it("announces errors and supports a copy-free state", () => {
    const { rerender, unmount } = render(
      <NumberField id="teams" label="Teams" error="Use at least two teams." />,
    );
    expect(screen.getByRole("spinbutton", { name: "Teams" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Use at least two teams.");

    rerender(<NumberField id="teams" label="Teams" />);
    expect(screen.getByRole("spinbutton", { name: "Teams" })).not.toHaveAttribute("aria-describedby");
    unmount();
  });
});
