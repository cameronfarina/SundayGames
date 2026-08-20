import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Select, type SelectOption } from "./Select.js";

beforeAll(() => {
  Object.defineProperties(Element.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
    setPointerCapture: { configurable: true, value: () => undefined },
  });
});

const options: SelectOption[] = [
  { label: "Sunday Games", value: "sunday" },
  { label: "Work league", value: "work" },
  { disabled: true, label: "Archived league", value: "archived" },
];

const StatefulSelect = () => {
  const [value, setValue] = useState("sunday");
  return <Select id="league" label="Active league" onValueChange={setValue} options={options} value={value} />;
};

describe("Select", () => {
  it("selects an enabled option and announces the label", async () => {
    const { unmount } = render(<StatefulSelect />);
    const trigger = screen.getByRole("combobox", { name: "Active league" });

    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("option", { name: "Work league" }));

    expect(trigger).toHaveTextContent("Work league");
    expect(trigger).toHaveFocus();
    unmount();
  });

  it("closes on Escape and returns focus", async () => {
    const { unmount } = render(<StatefulSelect />);
    const trigger = screen.getByRole("combobox", { name: "Active league" });

    await userEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    unmount();
  });

  it("closes when the user clicks outside", async () => {
    const { unmount } = render(<StatefulSelect />);
    await userEvent.click(screen.getByRole("combobox", { name: "Active league" }));

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    unmount();
  });

  it("keeps a hidden label out of the layout but in the accessible name", () => {
    const { unmount } = render(
      <Select id="league" label="Active league" labelHidden onValueChange={vi.fn()} options={options} />,
    );

    expect(screen.getByRole("combobox", { name: "Active league" })).toBeVisible();
    expect(screen.getByText("Active league")).toHaveClass("sr-only");
    unmount();
  });

  it("supports placeholders, disabled controls, and disabled options", async () => {
    const onValueChange = vi.fn();
    const { rerender, unmount } = render(
      <Select
        id="team"
        label="Team"
        onValueChange={onValueChange}
        options={options}
        placeholder="Choose a team"
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "Team" });
    expect(trigger).toHaveTextContent("Choose a team");
    await userEvent.click(trigger);
    expect(screen.getByRole("option", { name: "Archived league" })).toHaveAttribute("data-disabled");
    await userEvent.keyboard("{Escape}");

    rerender(
      <Select disabled id="team" label="Team" onValueChange={onValueChange} options={options} />,
    );
    expect(screen.getByRole("combobox", { name: "Team" })).toBeDisabled();
    unmount();
  });
});
