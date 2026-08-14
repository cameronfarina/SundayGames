import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveDraftWorkspace, type WorkspaceProps } from "./LiveDraftWorkspace";
import { liveDraftRoomSchema } from "../../api/liveDraftSchemas";
import { liveRoom } from "../../test/liveDraftFixtures";

const roomWithoutTeams = liveDraftRoomSchema.parse({
  ...liveRoom,
  salesLog: [],
  selectedTeam: undefined,
  teamSummaries: [],
  viewedTeam: undefined,
});

afterEach(() => { vi.restoreAllMocks(); });

describe("LiveDraftWorkspace actions", () => {
  it("runs start, pause, and resume from their matching room states", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn(() => Promise.resolve(liveRoom));
    const props: Omit<WorkspaceProps, "room"> = {
      busy: false,
      connection: "connected",
      createExport: vi.fn(() => Promise.reject(new Error("not used"))),
      onAction,
      onRefresh: vi.fn(() => Promise.resolve()),
    };
    const { rerender } = render(<LiveDraftWorkspace {...props} room={liveRoom} />);

    await user.click(screen.getByRole("button", { name: "Pause draft" }));
    await waitFor(() => { expect(onAction).toHaveBeenCalledWith({ action: "pause" }); });
    rerender(<LiveDraftWorkspace {...props} room={{ ...liveRoom, status: "paused" }} />);
    await user.click(screen.getByRole("button", { name: "Resume draft" }));
    await waitFor(() => { expect(onAction).toHaveBeenCalledWith({ action: "resume" }); });
    rerender(<LiveDraftWorkspace {...props} room={{ ...liveRoom, status: "setup" }} />);
    await user.click(screen.getByRole("button", { name: "Start draft" }));
    await waitFor(() => { expect(onAction).toHaveBeenCalledWith({ action: "start" }); });
  });

  it("submits a corrected sale through the typed room action", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onAction = vi.fn(() => Promise.resolve(liveRoom));
    render(<LiveDraftWorkspace
      busy={false}
      connection="connected"
      createExport={vi.fn(() => Promise.reject(new Error("not used")))}
      onAction={onAction}
      onRefresh={vi.fn(() => Promise.resolve())}
      room={liveRoom}
    />);

    await user.click(screen.getByRole("button", { name: "Correct sale of De'Von Achane" }));
    const command = screen.getByRole("textbox", { name: "Correct sale" });
    await user.clear(command);
    await user.type(command, "Seth drafted De'Von Achane for 49{Enter}");
    await waitFor(() => { expect(onAction).toHaveBeenCalledWith({
      action: "corrections",
      replacementSale: "Seth drafted De'Von Achane for 49",
      saleEventId: "sale-1",
    }); });
  });

  it("prefills a player without an owner when no teams are available", async () => {
    const user = userEvent.setup();
    render(<LiveDraftWorkspace
      busy
      connection="connected"
      createExport={vi.fn(() => Promise.reject(new Error("not used")))}
      onAction={vi.fn(() => Promise.resolve(liveRoom))}
      onRefresh={vi.fn(() => Promise.resolve())}
      room={roomWithoutTeams}
    />);

    await user.click(screen.getByRole("button", { name: "Use Puka Nacua in sale command" }));
    expect(screen.getByRole("textbox", { name: "Sale command" })).toHaveValue("Puka Nacua ");
    expect(screen.getByText("No team rosters are available.")).toBeVisible();
  });
});
