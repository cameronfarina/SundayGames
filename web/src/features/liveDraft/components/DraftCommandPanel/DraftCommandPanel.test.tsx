import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DraftCommandPanel } from "./DraftCommandPanel";
import { liveRoom } from "../../test/liveDraftFixtures";

const handlers = {
  onCommandChange: vi.fn(),
  onEnd: vi.fn(),
  onLogSale: vi.fn(),
  onPauseOrResume: vi.fn(),
  onStart: vi.fn(),
  onUndo: vi.fn(),
};

describe("DraftCommandPanel", () => {
  it("submits a commissioner sale with Enter and exposes live controls", async () => {
    const user = userEvent.setup();
    const onLogSale = vi.fn();
    render(<DraftCommandPanel
      {...handlers}
      command="Cam drafted Puka Nacua for 62"
      onLogSale={onLogSale}
      room={liveRoom}
    />);

    await user.type(screen.getByRole("textbox", { name: "Sale command" }), "{Enter}");
    expect(onLogSale).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Pause draft" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Undo latest sale" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "End draft" })).toBeEnabled();
  });

  it("starts setup rooms and resumes paused rooms", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DraftCommandPanel
      {...handlers}
      command=""
      room={{ ...liveRoom, salesLog: [], status: "setup" }}
    />);
    await user.click(screen.getByRole("button", { name: "Start draft" }));
    expect(handlers.onStart).toHaveBeenCalled();

    rerender(<DraftCommandPanel
      {...handlers}
      command=""
      room={{ ...liveRoom, status: "paused" }}
    />);
    await user.click(screen.getByRole("button", { name: "Resume draft" }));
    expect(handlers.onPauseOrResume).toHaveBeenCalled();
  });

  it("shows member guidance instead of mutation controls", () => {
    render(<DraftCommandPanel
      {...handlers}
      command=""
      room={{ ...liveRoom, canMutateRoom: false, role: "member" }}
    />);
    expect(screen.getByText(/League members can follow/)).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Sale command" })).not.toBeInTheDocument();
  });

  it("shows validation, feedback, and pending progress", async () => {
    const user = userEvent.setup();
    const onLogSale = vi.fn();
    const { rerender } = render(<DraftCommandPanel
      {...handlers}
      command="   "
      onLogSale={onLogSale}
      room={liveRoom}
    />);
    await user.click(screen.getByRole("button", { name: "Log sale" }));
    expect(screen.getByText("Enter an owner, player, and sale price.")).toBeVisible();
    expect(onLogSale).not.toHaveBeenCalled();

    rerender(<DraftCommandPanel
      {...handlers}
      busy
      command="Cam puka 62"
      feedback={{ message: "Logging sale...", variant: "info" }}
      room={liveRoom}
    />);
    expect(screen.getByRole("button", { name: "Log sale" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Logging sale...")).toBeVisible();
  });
});
