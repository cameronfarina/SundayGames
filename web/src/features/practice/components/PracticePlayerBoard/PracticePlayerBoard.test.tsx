import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PlayerCatalog } from "../../api/playerCatalogSchema";
import { PracticePlayerBoard } from "./PracticePlayerBoard";

const catalog: PlayerCatalog = {
  players: [{ expectedPrice: 70, name: "Puka Nacua", position: "WR" }],
};

describe("PracticePlayerBoard", () => {
  it("shows progress while the catalog loads", () => {
    render(<PracticePlayerBoard catalog={undefined} error={null} isPending onRetry={vi.fn()} onSaveMyValue={vi.fn()}
      onToggleTarget={vi.fn()} shortlist={[]} targetChangesDisabled={false} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading the player board");
  });

  it("shows an actionable catalog error", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<PracticePlayerBoard catalog={undefined} error={new Error("Catalog unavailable")} onSaveMyValue={vi.fn()}
      isPending={false} onRetry={onRetry} onToggleTarget={vi.fn()} shortlist={[]}
      targetChangesDisabled={false} />);
    expect(screen.getByText("Catalog unavailable")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry board" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows the player board when catalog data is ready", () => {
    render(<PracticePlayerBoard catalog={catalog} error={null} isPending={false} onSaveMyValue={vi.fn()}
      onRetry={vi.fn()} onToggleTarget={vi.fn()} shortlist={[]} targetChangesDisabled={false} />);
    expect(screen.getByRole("heading", { name: "Available players" })).toBeInTheDocument();
    expect(screen.getByText("Puka Nacua")).toBeInTheDocument();
  });

  it("shows an empty state when the catalog has no players", () => {
    render(<PracticePlayerBoard catalog={{ players: [] }} error={null} isPending={false} onSaveMyValue={vi.fn()}
      onRetry={vi.fn()} onToggleTarget={vi.fn()} shortlist={[]} targetChangesDisabled={false} />);
    expect(screen.getByText("No players are available for this board yet.")).toBeInTheDocument();
  });
});
