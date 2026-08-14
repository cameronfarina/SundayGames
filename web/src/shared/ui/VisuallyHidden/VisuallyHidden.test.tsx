import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VisuallyHidden } from "./VisuallyHidden.js";

describe("VisuallyHidden", () => {
  it("keeps text available to accessible names", () => {
    const { unmount } = render(
      <button type="button">
        <span aria-hidden="true">+</span>
        <VisuallyHidden>Add player</VisuallyHidden>
      </button>,
    );

    expect(screen.getByRole("button", { name: "Add player" })).toBeInTheDocument();
    unmount();
  });
});
