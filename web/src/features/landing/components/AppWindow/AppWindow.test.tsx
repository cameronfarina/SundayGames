import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppWindow } from "./AppWindow";

describe("AppWindow", () => {
  it("frames the still as a page on the product's own address", () => {
    render(<AppWindow><p>still</p></AppWindow>);

    expect(screen.getByText("sundaygames.io")).toBeVisible();
    expect(screen.getByText("still")).toBeVisible();
  });

  it("underlines the tab the still was taken from", () => {
    render(<AppWindow activeLabel="Practice"><p>still</p></AppWindow>);

    expect(screen.getByText("Practice")).toHaveClass("app-window__tab--active");
    expect(screen.getByText("League")).not.toHaveClass("app-window__tab--active");
  });

  it("keeps the frame out of the reading order", () => {
    render(<AppWindow><p>still</p></AppWindow>);

    expect(screen.queryByRole("listitem")).toBeNull();
  });
});
