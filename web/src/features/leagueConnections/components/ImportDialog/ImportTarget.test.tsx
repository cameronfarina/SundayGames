import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ImportMode } from "../../lib/importRequest";
import { ImportTarget } from "./ImportTarget";

beforeAll(() => {
  Object.defineProperties(Element.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
    setPointerCapture: { configurable: true, value: () => undefined },
  });
});

const leagues = [
  { label: "Sunday Games", value: "season-1" },
  { label: "Work league", value: "season-2" },
];

const createMode: ImportMode = "create";

const renderTarget = (overrides: Partial<Parameters<typeof ImportTarget>[0]> = {}) => {
  const utils = {
    leagues,
    mode: createMode,
    note: undefined,
    onModeChange: vi.fn(),
    onSeasonIdChange: vi.fn(),
    seasonId: undefined,
    ...overrides,
  };
  render(<ImportTarget {...utils} />);
  return utils;
};

describe("ImportTarget", () => {
  it("builds a new league unless the owner says otherwise", () => {
    renderTarget();

    expect(screen.getByRole("radio", { name: "A new Sunday Games league" })).toBeChecked();
    expect(screen.queryByRole("combobox", { name: "League to replace" })).not.toBeInTheDocument();
  });

  it("asks which league a replacement would overwrite", async () => {
    const user = userEvent.setup();
    const utils = renderTarget({ mode: "overwrite" });

    await user.click(screen.getByRole("combobox", { name: "League to replace" }));
    await user.click(screen.getByRole("option", { name: "Work league" }));

    expect(utils.onSeasonIdChange).toHaveBeenCalledWith("season-2");
  });

  it("shows the league already chosen for a replacement", () => {
    renderTarget({ mode: "overwrite", seasonId: "season-1" });

    expect(screen.getByRole("combobox", { name: "League to replace" }))
      .toHaveTextContent("Sunday Games");
  });

  it("reports the choice back when the owner switches mode", async () => {
    const user = userEvent.setup();
    const utils = renderTarget();

    await user.click(screen.getByRole("radio", { name: "A league you already run, replaced" }));

    expect(utils.onModeChange).toHaveBeenCalledWith("overwrite");
  });

  it("lets the owner go back to building a new league", async () => {
    const user = userEvent.setup();
    const utils = renderTarget({ mode: "overwrite" });

    await user.click(screen.getByRole("radio", { name: "A new Sunday Games league" }));

    expect(utils.onModeChange).toHaveBeenCalledWith("create");
  });

  it("offers no replacement when the owner runs no leagues, and says why", () => {
    renderTarget({ leagues: [], note: "You do not run a league here yet." });

    expect(screen.getByRole("radio", { name: "A league you already run, replaced" }))
      .toBeDisabled();
    expect(screen.getByText("You do not run a league here yet.")).toBeVisible();
  });
});
