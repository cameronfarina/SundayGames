import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog.js";

describe("Dialog", () => {
  it("labels its content and closes with the close button", async () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(
      <Dialog
        description="Review the league before it is created."
        onOpenChange={onOpenChange}
        title="Input league info"
        trigger={<button type="button">Open setup</button>}
      >
        <label htmlFor="season">Season</label>
        <input id="season" />
      </Dialog>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Open setup" }));
    const dialog = screen.getByRole("dialog", { name: "Input league info" });
    expect(dialog).toHaveAccessibleDescription("Review the league before it is created.");
    expect(screen.getByLabelText("Season")).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open setup" })).toHaveFocus();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    unmount();
  });

  it("closes on Escape and outside interaction", async () => {
    const { unmount } = render(
      <Dialog title="League setup" trigger={<button type="button">Edit</button>}>
        Setup content
      </Dialog>,
    );
    const trigger = screen.getByRole("button", { name: "Edit" });

    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await userEvent.click(trigger);
    fireEvent.pointerDown(screen.getByTestId("dialog-overlay"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();
  });

  it("supports controlled, initially open content with a footer and no trigger", () => {
    const { unmount } = render(
      <Dialog footer={<button type="button">Finish</button>} open title="Review league">
        Ready to create.
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Review league" });
    expect(dialog).toHaveTextContent("Ready to create.");
    expect(dialog).toHaveAccessibleDescription("Review league dialog");
    expect(screen.getByRole("button", { name: "Finish" })).toBeInTheDocument();
    unmount();
  });
});
