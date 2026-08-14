import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { postDraftSchema } from "../../api/postDraftSchema";
import { postDraftResult } from "../../pages/MyTeamPage/MyTeamPage.postDraft.fixture";
import { PostDraftTeamView } from "./PostDraftTeam";

const teamWithReasons = (pickupMessage: string) => postDraftSchema.parse({
  ...postDraftResult,
  analysis: {
    ...postDraftResult.analysis,
    recommendationReadiness: {
      startSit: {
        status: "unavailable",
        reasons: [{ code: "snapshot_missing", input: "projections", message: "Set a lineup snapshot." }],
        snapshotIds: [],
      },
      pickupDrop: {
        status: "unavailable",
        reasons: [{ code: "snapshot_missing", input: "projections", message: pickupMessage }],
        snapshotIds: [],
      },
    },
  },
});

describe("PostDraftTeamView", () => {
  it("keeps readiness reasons from separate coaching categories distinct across rerenders", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = render(<PostDraftTeamView team={teamWithReasons("Set a free-agent snapshot.")} />);

    expect(screen.getByText("Set a lineup snapshot.")).toBeVisible();
    expect(screen.getByText("Set a free-agent snapshot.")).toBeVisible();

    view.rerender(<PostDraftTeamView team={teamWithReasons("Refresh the free-agent snapshot.")} />);

    expect(screen.getByText("Set a lineup snapshot.")).toBeVisible();
    expect(screen.queryByText("Set a free-agent snapshot.")).not.toBeInTheDocument();
    expect(screen.getByText("Refresh the free-agent snapshot.")).toBeVisible();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
