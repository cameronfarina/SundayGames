import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "./Skeleton.js";

describe("Skeleton", () => {
  it("is hidden from assistive technology with stable default dimensions", () => {
    const { unmount } = render(<Skeleton data-testid="skeleton" />);
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    expect(skeleton).toHaveStyle({ width: "100%", height: "1rem" });
    unmount();
  });

  it("accepts explicit dimensions", () => {
    const { unmount } = render(
      <Skeleton data-testid="skeleton" width="12rem" height="2rem" />,
    );
    expect(screen.getByTestId("skeleton")).toHaveStyle({ width: "12rem", height: "2rem" });
    unmount();
  });
});
