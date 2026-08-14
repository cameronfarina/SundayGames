import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InlineNotice, type NoticeVariant } from "./InlineNotice.js";

const statusVariants: NoticeVariant[] = ["info", "success", "warning"];

describe("InlineNotice", () => {
  it.each(statusVariants)("renders a %s status", variant => {
    const { unmount } = render(
      <InlineNotice variant={variant} title="Update">
        League values changed.
      </InlineNotice>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("UpdateLeague values changed.");
    unmount();
  });

  it("uses an alert for errors and permits a title-free message", () => {
    const { unmount } = render(
      <InlineNotice variant="error">Could not save the keeper.</InlineNotice>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save the keeper.");
    unmount();
  });
});
