import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button.js";

describe("Button", () => {
  it("renders a safe primary button and handles activation", async () => {
    const onClick = vi.fn();
    const { unmount } = render(<Button onClick={onClick}>Save league</Button>);

    const button = screen.getByRole("button", { name: "Save league" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("button--primary");

    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
    unmount();
  });

  it("supports every visual variant and full-width layout", () => {
    const { unmount } = render(
      <>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Danger</Button>
        <Button fullWidth>Wide</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Secondary" })).toHaveClass("button--secondary");
    expect(screen.getByRole("button", { name: "Danger" })).toHaveClass("button--danger");
    expect(screen.getByRole("button", { name: "Wide" })).toHaveClass("button--full-width");
    unmount();
  });
});
