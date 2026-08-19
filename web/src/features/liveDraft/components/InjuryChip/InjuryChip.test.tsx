import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InjuryChip } from "./InjuryChip";

const injury = {
  headline: "Gibbs is limited with an ankle injury",
  publishedAt: "2026-09-17T12:19:00.000Z",
};

describe("InjuryChip", () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it("says INJ in words so the colour is never the only signal", () => {
    render(<InjuryChip injury={injury} />);

    expect(screen.getByRole("button")).toHaveTextContent("INJ");
  });

  it("reaches the headline by pointer, keyboard, and tap alike", () => {
    vi.stubEnv("TZ", "America/New_York");
    const label = "Injury report: Gibbs is limited with an ankle injury (9/17 8:19am)";
    render(<InjuryChip injury={injury} />);

    // A focusable button carries the label for a keyboard and a screen reader;
    // the title serves a pointer even where the styled tooltip cannot show.
    const chip = screen.getByRole("button", { name: label });
    expect(chip).toHaveAttribute("title", label);
    chip.focus();
    expect(chip).toHaveFocus();
  });

  it("keeps the headline when the report carries no readable timestamp", () => {
    render(<InjuryChip injury={{ ...injury, publishedAt: "not-a-date" }} />);

    expect(screen.getByRole("button", {
      name: "Injury report: Gibbs is limited with an ankle injury",
    })).toBeVisible();
  });

  it("renders nothing at all for a player with no injury report", () => {
    const { container } = render(<InjuryChip />);

    expect(container).toBeEmptyDOMElement();
  });
});
