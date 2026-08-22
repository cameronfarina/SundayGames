import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  importedConnectionFixture,
  needsAttentionConnectionFixture,
  syncedConnectionFixture,
} from "../../api/leagueConnections.fixture";
import type { LeagueConnection } from "../../api/leagueConnectionsSchema";
import { ConnectionCardActions } from "./ConnectionCardActions";

const sleeperNeedsAttentionFixture: LeagueConnection = {
  ...needsAttentionConnectionFixture,
  id: "connection-sleeper-attention",
  provider: "sleeper",
  displayName: "Sleeper Needs Attention",
};

const renderActions = (
  overrides: Partial<Parameters<typeof ConnectionCardActions>[0]> = {},
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
  render(<ConnectionCardActions {...utils} />);
  return utils;
};

describe("ConnectionCardActions", () => {
  it("offers to import a connection that is not a Sunday Games league yet", async () => {
    const user = userEvent.setup();
    const utils = renderActions();

    await user.click(screen.getByRole("button", { name: "Import Sleeper Friends League" }));

    expect(utils.onImport).toHaveBeenCalledWith("connection-sleeper");
  });

  it("stops offering an import once one has been done", () => {
    renderActions({ connection: importedConnectionFixture });

    expect(screen.queryByRole("button", { name: "Import Sleeper Friends League" }))
      .not.toBeInTheDocument();
  });

  it("hides the sync button while the league is already up to date", () => {
    renderActions();

    expect(screen.queryByRole("button", { name: "Sync Sleeper Friends League now" }))
      .not.toBeInTheDocument();
  });

  it("passes the chosen connection to view, sync, and disconnect", async () => {
    const user = userEvent.setup();
    const utils = renderActions({ connection: sleeperNeedsAttentionFixture });

    await user.click(screen.getByRole("button", { name: "View Sleeper Needs Attention" }));
    await user.click(screen.getByRole("button", { name: "Sync Sleeper Needs Attention now" }));
    await user.click(screen.getByRole("button", { name: "Disconnect Sleeper Needs Attention" }));

    expect(utils.onSelect).toHaveBeenCalledWith("connection-sleeper-attention");
    expect(utils.onSync).toHaveBeenCalledWith("connection-sleeper-attention");
    expect(utils.onRemove).toHaveBeenCalledWith("connection-sleeper-attention");
  });

  it("replaces an ESPN sync that cannot carry cookies with a reconnect action", () => {
    renderActions({ connection: needsAttentionConnectionFixture });

    expect(screen.queryByRole("button", { name: "Sync Pigskin Power Bottoms now" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reconnect ESPN" }))
      .toHaveAttribute("href", "#connect-league");
  });

  it("stops every write while the card is mid-flight", () => {
    renderActions({
      connection: sleeperNeedsAttentionFixture,
      pending: true,
      selected: true,
    });

    expect(screen.getByRole("button", { name: "View Sleeper Needs Attention" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Import Sleeper Needs Attention" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sync Sleeper Needs Attention now" }))
      .toBeDisabled();
    expect(screen.getByRole("button", { name: "Disconnect Sleeper Needs Attention" }))
      .toBeDisabled();
  });
});
