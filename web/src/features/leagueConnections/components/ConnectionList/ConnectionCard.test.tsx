import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  needsAttentionConnectionFixture,
  syncedConnectionFixture,
} from "../../api/leagueConnections.fixture";
import { ConnectionCard } from "./ConnectionCard";

describe("ConnectionCard", () => {
  it("leads with the provider's own explanation when something needs fixing", () => {
    render(<ConnectionCard
      connection={needsAttentionConnectionFixture}
      onRemove={vi.fn()}
      onSelect={vi.fn()}
      onSync={vi.fn()}
      pending={false}
      selected={false}
    />);

    expect(screen.getByText("Needs attention")).toBeVisible();
    expect(screen.getByText(/Paste your espn_s2 and SWID cookies/u)).toBeVisible();
    expect(screen.getByText("espn")).toBeVisible();
  });

  it("names the league and its provider for a healthy connection", () => {
    render(<ConnectionCard
      connection={syncedConnectionFixture}
      onRemove={vi.fn()}
      onSelect={vi.fn()}
      onSync={vi.fn()}
      pending={false}
      selected
    />);

    expect(screen.getByRole("heading", { name: "Sleeper Friends League" })).toBeVisible();
    expect(screen.getByRole("button", { name: "View Sleeper Friends League" }))
      .toHaveAttribute("aria-pressed", "true");
  });
});
