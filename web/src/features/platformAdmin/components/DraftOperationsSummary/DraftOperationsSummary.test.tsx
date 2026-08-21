import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PlatformDraftSchedule } from "../../api/platformDraftOperationsSchema";
import { DraftOperationsSummary } from "./DraftOperationsSummary";

const schedule: PlatformDraftSchedule = {
  generatedAt: "2026-08-22T12:00:00.000Z",
  timezone: "America/New_York",
  today: [],
  upcoming: [],
  summary: {
    estimatedDraftDurationMinutes: 180,
    liveNow: 1,
    peakConcurrentDrafts: 3,
    peakWindow: null,
    roomsNotCreated: 2,
    scheduledToday: 4,
    scheduledUpcoming: 5,
  },
};

describe("DraftOperationsSummary", () => {
  it("shows the daily capacity and readiness totals", () => {
    render(<DraftOperationsSummary schedule={schedule} />);

    expect(screen.getByText("4 scheduled today")).toBeVisible();
    expect(screen.getByText("Peak: 3 concurrent")).toBeVisible();
    expect(screen.getByText("1")).toBeVisible();
    expect(screen.getByText("2 not created")).toBeVisible();
  });
});
