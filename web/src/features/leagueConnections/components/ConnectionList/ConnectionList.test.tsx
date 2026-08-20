import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { connectionListFixture } from "../../api/leagueConnections.fixture";
import { ConnectionList } from "./ConnectionList";

const connections = connectionListFixture.connections;

const renderList = (
  overrides: Partial<Parameters<typeof ConnectionList>[0]> = {},
) => {
  const props = {
    connections,
    onImport: vi.fn(),
    onRemove: vi.fn(),
    onSelect: vi.fn(),
    onSync: vi.fn(),
    pendingConnectionId: undefined,
    selectedConnectionId: undefined,
    ...overrides,
  };
  render(<MemoryRouter><ConnectionList {...props} /></MemoryRouter>);
  return props;
};

describe("ConnectionList", () => {
  it("invites the owner to connect a league when there are none", () => {
    renderList({ connections: [] });

    expect(screen.getByText("No leagues connected yet")).toBeVisible();
    expect(screen.queryByRole("list", { name: "Connected leagues" })).not.toBeInTheDocument();
  });

  it("shows each league's status, season, and last sync", () => {
    renderList();

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Synced")).toBeVisible();
    expect(screen.getByText(/2026 season · Last synced/u)).toBeVisible();
    expect(screen.getByText("2026 season · Never synced")).toBeVisible();
  });

  it("reports the generic summary when the provider gave no detail", () => {
    renderList();

    expect(screen.getByText("Rosters, matchups, and settings are up to date.")).toBeVisible();
  });

  it("passes the chosen connection to view, sync, and disconnect", async () => {
    const user = userEvent.setup();
    const utils = renderList();

    await user.click(screen.getByRole("button", { name: "View Sleeper Friends League" }));
    await user.click(screen.getByRole("button", { name: "Sync Sleeper Friends League now" }));
    await user.click(screen.getByRole("button", { name: "Disconnect Sleeper Friends League" }));

    expect(utils.onSelect).toHaveBeenCalledWith("connection-sleeper");
    expect(utils.onSync).toHaveBeenCalledWith("connection-sleeper");
    expect(utils.onRemove).toHaveBeenCalledWith("connection-sleeper");
  });

  it("marks the open league and disables a card that is mid-flight", () => {
    renderList({
      pendingConnectionId: "connection-sleeper",
      selectedConnectionId: "connection-sleeper",
    });

    expect(screen.getByRole("button", { name: "View Sleeper Friends League" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Sync Sleeper Friends League now" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sync Pigskin Power Bottoms now" })).toBeEnabled();
  });
});
