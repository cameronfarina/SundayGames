import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FinalActions } from "./FinalActions";
import { liveRoom } from "../../test/liveDraftFixtures";

describe("FinalActions", () => {
  it("offers commissioner export, recovery, and final team review", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    const onReopen = vi.fn();
    render(<FinalActions
      download={{ fileName: "draft.csv", href: "data:text/csv,draft" }}
      onExport={onExport}
      onReopen={onReopen}
      room={{
        ...liveRoom,
        status: "ended",
        exportReadiness: { status: "ready", blockers: [], completedRevision: 9 },
      }}
    />);
    expect(screen.getByRole("link", { name: "View My Team" })).toHaveAttribute(
      "href",
      "/my-team?seasonId=season-1",
    );
    expect(screen.getByRole("link", { name: "Download final CSV" })).toHaveAttribute(
      "download",
      "draft.csv",
    );
    await user.click(screen.getByRole("button", { name: "Prepare final CSV" }));
    await user.click(screen.getByRole("button", { name: "Reopen draft" }));
    expect(onExport).toHaveBeenCalledOnce();
    expect(onReopen).toHaveBeenCalledOnce();
  });

  it("explains blocked exports and hides private actions from observers", () => {
    render(<FinalActions
      onExport={vi.fn()}
      onReopen={vi.fn()}
      room={{
        ...liveRoom,
        canMutateRoom: false,
        role: "observer",
        status: "ended",
        exportReadiness: { status: "blocked", blockers: ["Cam has 1 open roster slot."] },
      }}
    />);
    expect(screen.getByText("Cam has 1 open roster slot.")).toBeVisible();
    expect(screen.queryByRole("link", { name: "View My Team" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Prepare final CSV" })).not.toBeInTheDocument();
  });
});
