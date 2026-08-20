import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
  importedConnectionFixture,
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
  render(<MemoryRouter><ConnectionCardActions {...utils} /></MemoryRouter>);
  return utils;
};

describe("ConnectionCardActions", () => {
  it("offers to import a connection that is not a Sunday Games league yet", async () => {
    const user = userEvent.setup();
    const utils = renderActions();

    await user.click(screen.getByRole("button", { name: "Import Sleeper Friends League" }));

    expect(utils.onImport).toHaveBeenCalledWith("connection-sleeper");
  });

  it("links straight to the league an import already built", () => {
    renderActions({ connection: importedConnectionFixture });

    expect(screen.getByRole("link", { name: "Open Sleeper Friends League in Sunday Games" }))
      .toHaveAttribute("href", "/leagues/sleeper-friends-league");
    expect(screen.queryByRole("button", { name: "Import Sleeper Friends League" }))
      .not.toBeInTheDocument();
  });

  it("passes the chosen connection to view, sync, and disconnect", async () => {
    const user = userEvent.setup();
    const utils = renderActions();

    await user.click(screen.getByRole("button", { name: "View Sleeper Friends League" }));
    await user.click(screen.getByRole("button", { name: "Sync Sleeper Friends League now" }));
    await user.click(screen.getByRole("button", { name: "Disconnect Sleeper Friends League" }));

    expect(utils.onSelect).toHaveBeenCalledWith("connection-sleeper");
    expect(utils.onSync).toHaveBeenCalledWith("connection-sleeper");
    expect(utils.onRemove).toHaveBeenCalledWith("connection-sleeper");
  });

  it("stops every write while the card is mid-flight", () => {
    renderActions({ pending: true, selected: true });

    expect(screen.getByRole("button", { name: "View Sleeper Friends League" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Import Sleeper Friends League" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sync Sleeper Friends League now" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Disconnect Sleeper Friends League" }))
      .toBeDisabled();
  });
});
