import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
  importedConnectionFixture,
  needsAttentionConnectionFixture,
  syncedConnectionFixture,
} from "../../api/leagueConnections.fixture";
import { ConnectionCard } from "./ConnectionCard";

const renderCard = (
  overrides: Partial<Parameters<typeof ConnectionCard>[0]> = {},
) => {
  const utils = {
    connection: syncedConnectionFixture,
    onImport: vi.fn(),
    onRemove: vi.fn(),
    onSelect: vi.fn(),
    onSync: vi.fn(),
    pending: false,
    selected: false,
    ...overrides,
  };
  render(<MemoryRouter><ConnectionCard {...utils} /></MemoryRouter>);
  return utils;
};

describe("ConnectionCard", () => {
  it("leads with the provider's own explanation when something needs fixing", () => {
    renderCard({ connection: needsAttentionConnectionFixture });

    expect(screen.getByText("Needs attention")).toBeVisible();
    expect(screen.getByText(/Paste your espn_s2 and SWID cookies/u)).toBeVisible();
    expect(screen.getByText("espn")).toBeVisible();
  });

  it("names the league and its provider for a healthy connection", () => {
    renderCard({ selected: true });

    expect(screen.getByRole("heading", { name: "Sleeper Friends League" })).toBeVisible();
    expect(screen.getByRole("button", { name: "View Sleeper Friends League" }))
      .toHaveAttribute("aria-pressed", "true");
  });

  it("says which Sunday Games league an import produced", () => {
    renderCard({ connection: importedConnectionFixture });

    expect(screen.getByText("Imported as Sleeper Friends League")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Import Sleeper Friends League" }))
      .not.toBeInTheDocument();
  });
});
