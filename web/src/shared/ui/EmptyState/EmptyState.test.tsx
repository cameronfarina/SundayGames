import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState.js";

describe("EmptyState", () => {
  it("renders optional artwork and an action", () => {
    const { unmount } = render(
      <EmptyState
        title="No simulations yet"
        description="Run a strategy to compare outcomes."
        icon={<span data-testid="artwork">S</span>}
        action={<button type="button">Run simulations</button>}
      />,
    );

    expect(screen.getByRole("heading", { name: "No simulations yet" })).toBeInTheDocument();
    expect(screen.getByTestId("empty-state-icon")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Run simulations" })).toBeInTheDocument();
    unmount();
  });

  it("renders without optional content", () => {
    const { unmount } = render(
      <EmptyState title="No team" description="Claim a team to continue." />,
    );
    expect(screen.getByText("Claim a team to continue.")).toBeInTheDocument();
    unmount();
  });
});
