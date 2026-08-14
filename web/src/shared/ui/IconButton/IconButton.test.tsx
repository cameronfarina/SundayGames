import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IconButton } from "./IconButton.js";

describe("IconButton", () => {
  it("provides an accessible name and activates from the keyboard", async () => {
    const onClick = vi.fn();
    const { unmount } = render(
      <IconButton label="Remove keeper" onClick={onClick}>
        <span aria-hidden="true">X</span>
      </IconButton>,
    );

    const button = screen.getByRole("button", { name: "Remove keeper" });
    button.focus();
    await userEvent.keyboard("{Enter}");

    expect(onClick).toHaveBeenCalledOnce();
    expect(button).toHaveAttribute("type", "button");
    unmount();
  });

  it("provides a visual tooltip and respects disabled state", () => {
    const { unmount } = render(<IconButton disabled label="Unavailable action">X</IconButton>);
    const button = screen.getByRole("button", { name: "Unavailable action" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Unavailable action");
    expect(screen.getByText("Unavailable action")).toHaveAttribute("aria-hidden", "true");
    unmount();
  });

  it("keeps the tooltip attached while focused", async () => {
    const { unmount } = render(<IconButton label="Open menu">M</IconButton>);
    const button = screen.getByRole("button", { name: "Open menu" });

    await userEvent.tab();
    expect(button).toHaveFocus();
    expect(screen.getByText("Open menu")).toBeInTheDocument();
    await userEvent.tab();
    expect(button).not.toHaveFocus();
    unmount();
  });
});
