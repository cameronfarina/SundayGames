import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformApiError } from "../../../../shared/api/http/PlatformApiError";
import { LiveDraftWorkspace, type WorkspaceProps } from "./LiveDraftWorkspace";
import { renderLiveDraftWorkspace } from "./LiveDraftWorkspace.testSupport";
import { liveDraftExportSchema, liveDraftRoomSchema, type LiveDraftExport } from "../../api/liveDraftSchemas";
import { liveRoom } from "../../test/liveDraftFixtures";

const endedRoom = liveDraftRoomSchema.parse({
  ...liveRoom,
  exportReadiness: { blockers: [], completedRevision: 2, status: "ready" },
  status: "ended",
});
const draftExport = liveDraftExportSchema.parse({
  artifact: {
    byteLength: 12,
    contentType: "text/csv",
    createdAt: "2026-08-13T20:00:00.000Z",
    format: "csv",
    id: "export-1",
    leagueId: "league-1",
    roomId: "room-1",
    seasonId: "season-1",
    sha256: "abc",
    sourceRevision: 2,
    storageKey: "/",
  },
  content: "Player,Price",
});

afterEach(() => { vi.restoreAllMocks(); });

describe("LiveDraftWorkspace failures", () => {
  it("refreshes after a stale room mutation", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn(() => Promise.resolve());
    renderLiveDraftWorkspace(<LiveDraftWorkspace
      busy={false}
      connection="connected"
      createExport={vi.fn(() => Promise.reject(new Error("not used")))}
      onAction={vi.fn(() => Promise.reject(new PlatformApiError({
        code: "stale_revision", message: "Stale", status: 409,
      })))}
      onRefresh={onRefresh}
      room={liveRoom}
    />);

    await user.click(screen.getByRole("button", { name: "Pause draft" }));
    expect(await screen.findByText(/room changed first/i)).toBeVisible();
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("shows non-Error failures and respects declined actions", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onAction = vi.fn(() => Promise.reject(new Error("Action failed")));
    renderLiveDraftWorkspace(<LiveDraftWorkspace
      busy={false}
      connection="connected"
      createExport={vi.fn(() => Promise.reject(new Error("not used")))}
      onAction={onAction}
      onRefresh={vi.fn(() => Promise.resolve())}
      room={liveRoom}
    />);

    await user.click(screen.getByRole("button", { name: "Pause draft" }));
    expect(await screen.findByText("Action failed")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "End draft" }));
    await user.click(screen.getByRole("button", { name: "Undo latest sale" }));
    await user.click(screen.getByRole("button", { name: "Correct sale of De'Von Achane" }));
    await user.click(screen.getByRole("button", { name: "Apply correction" }));
    expect(confirm).toHaveBeenCalledTimes(3);
    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.getByRole("form", { name: "Correct sale" })).toBeVisible();
  });

  it("does not force an incomplete draft to end without confirmation", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm")
      .mockReturnValueOnce(true).mockReturnValueOnce(false);
    const onAction = vi.fn(() => Promise.reject(new PlatformApiError({
      code: "draft_incomplete", message: "Open slots", status: 409,
    })));
    renderLiveDraftWorkspace(<LiveDraftWorkspace
      busy={false}
      connection="connected"
      createExport={vi.fn(() => Promise.reject(new Error("not used")))}
      onAction={onAction}
      onRefresh={vi.fn(() => Promise.resolve())}
      room={liveRoom}
    />);

    await user.click(screen.getByRole("button", { name: "End draft" }));
    await waitFor(() => { expect(confirm).toHaveBeenCalledTimes(2); });
    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.getByText("Draft remains open.")).toBeVisible();
  });

  it("reports failed sale and end requests", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onAction = vi.fn(() => Promise.reject(new Error("Room request failed")));
    renderLiveDraftWorkspace(<LiveDraftWorkspace
      busy={false}
      connection="connected"
      createExport={vi.fn(() => Promise.reject(new Error("not used")))}
      onAction={onAction}
      onRefresh={vi.fn(() => Promise.resolve())}
      room={liveRoom}
    />);

    const command = screen.getByRole("textbox", { name: "Sale command" });
    await user.type(command, "Owner11 drafted Puka Nacua for 62{Enter}");
    expect(await screen.findByText("Room request failed")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "End draft" }));
    await waitFor(() => { expect(onAction).toHaveBeenCalledTimes(2); });
  });

  it("reports export failures and supplies a fallback download name", async () => {
    const user = userEvent.setup();
    const createExport = vi.fn<() => Promise<LiveDraftExport>>(
      () => Promise.reject(new Error("Export failed")),
    );
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const props: WorkspaceProps = {
      busy: false,
      connection: "connected",
      createExport,
      onAction: vi.fn(() => Promise.resolve(liveRoom)),
      onRefresh: vi.fn(() => Promise.resolve()),
      room: endedRoom,
    };
    const { rerender } = renderLiveDraftWorkspace(<LiveDraftWorkspace {...props} />);

    await user.click(screen.getByRole("button", { name: "Prepare final CSV" }));
    expect(await screen.findByText("Export failed")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reopen draft" }));
    expect(confirm).toHaveBeenCalledOnce();

    createExport.mockResolvedValue(draftExport);
    rerender(<LiveDraftWorkspace {...props} createExport={createExport} />);
    await user.click(screen.getByRole("button", { name: "Prepare final CSV" }));
    expect(await screen.findByRole("link", { name: "Download final CSV" }))
      .toHaveAttribute("download", "mockd-draft.csv");
  });
});
