import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressButton } from "./ProgressButton.js";

describe("ProgressButton", () => {
  it("reports determinate progress and blocks activation while busy", () => {
    const { unmount } = render(<ProgressButton busy percent={42}>Run simulations</ProgressButton>);

    const button = screen.getByRole("button", { name: "Run simulations" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("progressbar", { name: "42% complete" })).toHaveAttribute(
      "aria-valuenow",
      "42",
    );
    unmount();
  });

  it("clamps invalid progress and preserves a caller-disabled state", () => {
    const { rerender, unmount } = render(
      <ProgressButton busy percent={-12}>Import</ProgressButton>,
    );
    expect(screen.getByRole("progressbar", { name: "0% complete" })).toBeInTheDocument();

    rerender(<ProgressButton busy percent={140}>Import</ProgressButton>);
    expect(screen.getByRole("progressbar", { name: "100% complete" })).toBeInTheDocument();

    rerender(<ProgressButton disabled percent={30}>Import</ProgressButton>);
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    rerender(<ProgressButton percent={30}>Import</ProgressButton>);
    expect(screen.getByRole("button", { name: "Import" })).toBeEnabled();
    unmount();
  });
});
