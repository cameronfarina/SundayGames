import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { auctionMockResponseFixture } from "../../test/auctionMockResponseFixture.js";
import { completedMockResponseFixture } from "../../test/completedMockResponseFixture.js";
import { setupMockResponseFixture } from "../../test/sessionResponseFixtures.js";
import { MockDraftActions } from "./MockDraftActions.js";

const handlers = () => ({
  onAbandon: vi.fn().mockResolvedValue(undefined),
  onComplete: vi.fn(),
  onStart: vi.fn(),
  onUndo: vi.fn(),
});

describe("MockDraftActions", () => {
  it("starts a setup draft", async () => {
    const actions = handlers();
    render(<MockDraftActions busy={false} state={setupMockResponseFixture().state} {...actions} />);
    await userEvent.click(screen.getByRole("button", { name: "Start draft" }));
    expect(actions.onStart).toHaveBeenCalledOnce();
  });

  it("shows setup progress while the start command is pending", () => {
    render(
      <MockDraftActions
        busy
        state={setupMockResponseFixture().state}
        {...handlers()}
      />,
    );
    expect(screen.getByRole("progressbar", { name: "55% complete" })).toBeInTheDocument();
  });

  it("offers active draft controls", async () => {
    const actions = handlers();
    const state = auctionMockResponseFixture().state;
    render(<MockDraftActions busy={false} state={state} {...actions} />);
    await userEvent.click(screen.getByRole("button", { name: "Undo pick" }));
    expect(actions.onUndo).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Finish mock" })).toBeDisabled();
  });

  it("keeps confirmation open when abandonment fails", async () => {
    const actions = handlers();
    actions.onAbandon.mockRejectedValue(new Error("Try again"));
    render(<MockDraftActions busy={false} state={auctionMockResponseFixture().state} {...actions} />);
    await userEvent.click(screen.getByRole("button", { name: "Abandon mock" }));
    const dialog = screen.getByRole("dialog", { name: "Abandon this mock?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Abandon mock" }));
    expect(actions.onAbandon).toHaveBeenCalledOnce();
    expect(dialog).toBeInTheDocument();
  });

  it("hides controls for a completed draft", () => {
    render(
      <MockDraftActions
        busy={false}
        state={completedMockResponseFixture().state}
        {...handlers()}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
