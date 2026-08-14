import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { FinalActions } from "./FinalActions";
import { liveRoom } from "../../test/liveDraftFixtures";

const LocationOutput = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
};

describe("FinalActions", () => {
  it("offers commissioner export, recovery, and final team review", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    const onReopen = vi.fn();
    render(<MemoryRouter initialEntries={["/draft-room"]}>
      <FinalActions
        download={{ fileName: "draft.csv", href: "data:text/csv,draft" }}
        onExport={onExport}
        onReopen={onReopen}
        room={{
          ...liveRoom,
          status: "ended",
          exportReadiness: { status: "ready", blockers: [], completedRevision: 9 },
        }}
      />
      <LocationOutput />
    </MemoryRouter>);
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
    await user.click(screen.getByRole("link", { name: "View My Team" }));
    expect(onExport).toHaveBeenCalledOnce();
    expect(onReopen).toHaveBeenCalledOnce();
    expect(screen.getByTestId("location")).toHaveTextContent("/my-team?seasonId=season-1");
  });

  it("explains blocked exports and hides private actions from observers", () => {
    render(<MemoryRouter><FinalActions
      onExport={vi.fn()}
      onReopen={vi.fn()}
      room={{
        ...liveRoom,
        canMutateRoom: false,
        role: "observer",
        status: "ended",
        exportReadiness: { status: "blocked", blockers: ["Owner11 has 1 open roster slot."] },
      }}
    /></MemoryRouter>);
    expect(screen.getByText("Owner11 has 1 open roster slot.")).toBeVisible();
    expect(screen.queryByRole("link", { name: "View My Team" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Prepare final CSV" })).not.toBeInTheDocument();
  });
});
