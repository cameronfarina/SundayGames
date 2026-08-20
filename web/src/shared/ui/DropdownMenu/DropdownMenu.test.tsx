import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DropdownMenu, type DropdownMenuItem } from "./DropdownMenu.js";

const menuItems = (onSelect: () => void): DropdownMenuItem[] => [
  { label: "League settings", onSelect },
  { disabled: true, label: "Reset password", onSelect },
  { destructive: true, label: "Sign out", onSelect },
];

describe("DropdownMenu", () => {
  it("runs an item command and closes", async () => {
    const onSelect = vi.fn();
    const { unmount } = render(
      <DropdownMenu items={menuItems(onSelect)} label="Account menu" />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "League settings" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    unmount();
  });

  it("closes outside and on Escape with focus restoration", async () => {
    const { unmount } = render(
      <DropdownMenu items={menuItems(vi.fn())} label="Account menu">CF</DropdownMenu>,
    );
    const trigger = screen.getByRole("button", { name: "Account menu" });

    await userEvent.click(trigger);
    expect(screen.getByRole("menuitem", { name: "Reset password" })).toHaveAttribute("data-disabled");
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toHaveClass("dropdown-menu__item--danger");
    await userEvent.keyboard("{Escape}");
    expect(trigger).toHaveFocus();

    await userEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    unmount();
  });

  it("heads a run of rows without making the heading pressable", async () => {
    const { unmount } = render(
      <DropdownMenu
        items={[{ groupLabel: "Leagues", label: "The Sunday Games", onSelect: vi.fn() }]}
        label="Account menu"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));

    expect(screen.getByText("Leagues")).toHaveClass("dropdown-menu__label");
    expect(screen.getAllByRole("menuitem").map(item => item.textContent))
      .toEqual(["The Sunday Games"]);
    unmount();
  });

  it("falls back to a familiar menu symbol", () => {
    const { unmount } = render(<DropdownMenu items={[]} label="More actions" />);
    expect(screen.getByRole("button", { name: "More actions" })).toHaveTextContent("⋯");
    unmount();
  });
});
