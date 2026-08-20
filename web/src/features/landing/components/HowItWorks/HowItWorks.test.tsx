import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HowItWorks } from "./HowItWorks";

describe("HowItWorks", () => {
  it("gives a visitor the three steps before the detail arrives", () => {
    render(<HowItWorks />);

    expect(screen.getAllByRole("listitem").map(step => step.textContent)).toEqual([
      "1Connect your leagueRead-only import from Sleeper or ESPN",
      "2Simulate the roomOutcomes built from your settings",
      "3Build your planTargets, ceilings and backups",
    ]);
  });
});
