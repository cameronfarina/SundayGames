import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ValueCallout } from "./ValueCallout";

describe("ValueCallout", () => {
  it("shows the gap between what the market pays and what this league pays", () => {
    render(<ValueCallout />);

    expect(screen.getAllByRole("term").map(label => label.textContent))
      .toEqual(["Market", "Your league", "Your max"]);
    expect(screen.getAllByRole("definition").map(value => value.textContent))
      .toEqual(["$57", "$72", "$75"]);
  });
});
