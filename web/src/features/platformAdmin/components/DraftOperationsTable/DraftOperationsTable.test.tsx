import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PlatformDraftOperationsItem } from "../../api/platformDraftOperationsSchema";
import { DraftOperationsTable } from "./DraftOperationsTable";

const draft: PlatformDraftOperationsItem = {
  draftFormat: "auction",
  endedAt: null,
  leagueId: "league-1",
  leagueName: "Sunday Games",
  readiness: "room_ready",
  roomId: "room-1",
  roomStatus: "countdown",
  seasonId: "season-1",
  seasonName: "2026 season",
  seasonYear: 2026,
  startedAt: null,
  startsAt: "2026-08-22T23:00:00.000Z",
  teamCount: 12,
};

describe("DraftOperationsTable", () => {
  it("shows a scheduled draft using the operations timezone", () => {
    render(<DraftOperationsTable drafts={[draft]} emptyMessage="None" timezone="America/New_York" />);

    expect(screen.getByText("Sunday Games")).toBeVisible();
    expect(screen.getByText("12 teams · Auction")).toBeVisible();
    expect(screen.getByText("Countdown")).toBeVisible();
  });

  it("shows the supplied empty state", () => {
    render(<DraftOperationsTable drafts={[]} emptyMessage="No drafts today." timezone="UTC" />);

    expect(screen.getByText("No drafts today.")).toBeVisible();
  });
});
