import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { StatusLegend } from "./StatusLegend";

describe("StatusLegend", () => {
  it("stays out of the way until it is asked for", () => {
    render(<StatusLegend />);

    expect(screen.getByRole("button", { name: "What do the colors mean?" }))
      .toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Synced")).not.toBeInTheDocument();
  });

  it("explains all four colors on a tap, not only on hover", async () => {
    const user = userEvent.setup();
    render(<StatusLegend />);

    await user.click(screen.getByRole("button", { name: "What do the colors mean?" }));

    expect(screen.getByText("Synced")).toBeVisible();
    expect(screen.getByText("Needs attention")).toBeVisible();
    expect(screen.getByText("Sync failed")).toBeVisible();
    expect(screen.getByText("Not synced yet")).toBeVisible();
    expect(screen.getByText("Rosters, matchups, and settings are up to date.")).toBeVisible();
  });

  it("closes again when the reader is done with it", async () => {
    const user = userEvent.setup();
    render(<StatusLegend />);
    const toggle = screen.getByRole("button", { name: "What do the colors mean?" });

    await user.click(toggle);
    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Synced")).not.toBeInTheDocument();
  });
});
