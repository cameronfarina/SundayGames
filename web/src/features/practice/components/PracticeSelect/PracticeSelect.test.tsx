import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PracticeSelect } from "./PracticeSelect";

beforeAll(() => {
  Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
    setPointerCapture: { configurable: true, value: () => undefined },
  });
});

describe("PracticeSelect", () => {
  it("opens an accessible listbox and commits the selected value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const view = render(
      <PracticeSelect
        label="Sort players"
        onValueChange={onValueChange}
        options={[
          { label: "Market value", value: "market" },
          { label: "My value", value: "mine" },
        ]}
        value="market"
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Sort players" }));
    await user.click(screen.getByRole("option", { name: "My value" }));

    expect(onValueChange).toHaveBeenCalledWith("mine");
    view.unmount();
  });
});
