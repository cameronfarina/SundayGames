import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PracticeShortlistItem } from "../../api/practiceContextSchema";
import { ShortlistPanel } from "./ShortlistPanel";

const item: PracticeShortlistItem = {
  createdAt: "2026-08-13T12:00:00.000Z",
  id: "target-1",
  leagueId: "league-1",
  maxBid: 15,
  playerName: "Jadarian Price",
  position: "RB",
  priority: 1,
  seasonId: "season-1",
  updatedAt: "2026-08-13T12:00:00.000Z",
  userId: "user-1",
};

describe("ShortlistPanel", () => {
  it("saves a maximum bid and removes a target", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const onSave = vi.fn();
    const view = render(<ShortlistPanel items={[item]} onRemove={onRemove} onSave={onSave} pending={false} />);

    const input = screen.getByRole("spinbutton", { name: "Maximum bid for Jadarian Price" });
    await user.clear(input);
    await user.type(input, "18");
    await user.click(screen.getByRole("button", { name: "Save Jadarian Price maximum bid" }));
    expect(onSave).toHaveBeenCalledWith(item, 18);
    await user.click(screen.getByRole("button", { name: "Remove Jadarian Price" }));
    expect(onRemove).toHaveBeenCalledWith(item);
    view.unmount();
  });

  it("supports an uncapped target and an empty plan", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { rerender, unmount } = render(
      <ShortlistPanel items={[item]} onRemove={vi.fn()} onSave={onSave} pending={false} />,
    );
    await user.clear(screen.getByRole("spinbutton", { name: "Maximum bid for Jadarian Price" }));
    await user.click(screen.getByRole("button", { name: "Save Jadarian Price maximum bid" }));
    expect(onSave).toHaveBeenCalledWith(item, undefined);

    rerender(<ShortlistPanel items={[]} onRemove={vi.fn()} onSave={vi.fn()} pending={false} />);
    expect(screen.getByText("Star players on the board to build this plan.")).toBeInTheDocument();
    unmount();
  });

  it("treats snake shortlist entries as pick targets without bid controls", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<ShortlistPanel
      draftFormat="snake"
      items={[item]}
      onRemove={onRemove}
      onSave={vi.fn()}
      pending={false}
    />);

    expect(screen.getByText("Prioritized when available at one of your picks.")).toBeVisible();
    expect(screen.queryByRole("spinbutton", { name: "Maximum bid for Jadarian Price" }))
      .not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Jadarian Price" }));
    expect(onRemove).toHaveBeenCalledWith(item);
  });
});
