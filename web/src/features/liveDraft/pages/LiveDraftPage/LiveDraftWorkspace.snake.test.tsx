import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { liveDraftRoomSchema } from "../../api/liveDraftSchemas";
import { liveRoom } from "../../test/liveDraftFixtures";
import { LiveDraftWorkspace } from "./LiveDraftWorkspace";
import { renderLiveDraftWorkspace } from "./LiveDraftWorkspace.testSupport";

const onTheClock = {
  overall: 1,
  round: 1,
  pickInRound: 1,
  teamId: "team-1",
  ownerDisplayName: "Owner11",
  teamDisplayName: "Short King",
};

describe("LiveDraftWorkspace snake actions", () => {
  it("fills a snake pick with the team on the clock and no price", async () => {
    const user = userEvent.setup();
    const snakeRoom = liveDraftRoomSchema.parse({
      ...liveRoom,
      onTheClock,
      picks: [onTheClock, {
        ...onTheClock,
        overall: 2,
        pickInRound: 2,
        teamId: "team-owner04",
        ownerDisplayName: "Owner04",
      }],
    });

    renderLiveDraftWorkspace(<LiveDraftWorkspace
      busy={false}
      connection="connected"
      createExport={vi.fn(() => Promise.reject(new Error("not used")))}
      onAction={vi.fn(() => Promise.resolve(liveRoom))}
      onRefresh={vi.fn(() => Promise.resolve())}
      room={snakeRoom}
    />);

    expect(screen.getByRole("heading", { name: "Draft board" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Use Puka Nacua in pick command" }));
    expect(screen.getByRole("textbox", { name: "Pick command" }))
      .toHaveValue("Owner11 drafted Puka Nacua");
  });

  it("lets the manager on the clock submit their own snake pick", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn(() => Promise.resolve(liveRoom));
    const snakeMemberRoom = liveDraftRoomSchema.parse({
      ...liveRoom,
      canMutateRoom: false,
      canExportDraft: false,
      canLogPick: true,
      role: "member",
      onTheClock,
      picks: [onTheClock],
    });

    renderLiveDraftWorkspace(<LiveDraftWorkspace
      busy={false}
      connection="connected"
      createExport={vi.fn(() => Promise.reject(new Error("not used")))}
      onAction={onAction}
      onRefresh={vi.fn(() => Promise.resolve())}
      room={snakeMemberRoom}
    />);

    await user.click(screen.getByRole("button", { name: "Use Puka Nacua in pick command" }));
    expect(screen.getByRole("textbox", { name: "Pick command" }))
      .toHaveValue("Owner11 drafted Puka Nacua");
    await user.click(screen.getByRole("button", { name: "Make pick" }));
    await waitFor(() => { expect(onAction).toHaveBeenCalledWith({
      action: "sales",
      command: "Owner11 drafted Puka Nacua",
    }); });
  });
});
