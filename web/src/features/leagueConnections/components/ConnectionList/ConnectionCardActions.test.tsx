import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  importedConnectionFixture,
  needsAttentionConnectionFixture,
  syncedConnectionFixture,
} from "../../api/leagueConnections.fixture";
import { ConnectionCardActions } from "./ConnectionCardActions";

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
    const utils = renderActions({ connection: needsAttentionConnectionFixture });

    await user.click(screen.getByRole("button", { name: "View Pigskin Power Bottoms" }));
    await user.click(screen.getByRole("button", { name: "Sync Pigskin Power Bottoms now" }));
    await user.click(screen.getByRole("button", { name: "Disconnect Pigskin Power Bottoms" }));

    expect(utils.onSelect).toHaveBeenCalledWith("connection-espn");
    expect(utils.onSync).toHaveBeenCalledWith("connection-espn");
    expect(utils.onRemove).toHaveBeenCalledWith("connection-espn");
  });

  it("stops every write while the card is mid-flight", () => {
    renderActions({
      connection: needsAttentionConnectionFixture,
      pending: true,
      selected: true,
    });

    expect(screen.getByRole("button", { name: "View Pigskin Power Bottoms" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Import Pigskin Power Bottoms" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sync Pigskin Power Bottoms now" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Disconnect Pigskin Power Bottoms" }))
      .toBeDisabled();
  });
});
