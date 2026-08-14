import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DraftStatus } from "./DraftStatus";
import { liveRoom } from "../../test/liveDraftFixtures";

describe("DraftStatus", () => {
  it("keeps the live status, revision, progress, and latest sale visible", () => {
    render(<DraftStatus connection="connected" room={liveRoom} />);
    expect(screen.getByText("Live", { selector: "strong" })).toBeVisible();
    expect(screen.getByText("Revision 2")).toBeVisible();
    expect(screen.getByText("Connected")).toBeVisible();
    expect(screen.getByText("1 sale · 1 of 4 spots filled")).toBeVisible();
    expect(screen.getByText("De'Von Achane to Cam for $50")).toBeVisible();
  });

  it("shows a useful empty latest-sale state", () => {
    render(<DraftStatus connection="polling" room={{ ...liveRoom, salesLog: [] }} />);
    expect(screen.getByText("Polling")).toBeVisible();
    expect(screen.getByText("No sales yet")).toBeVisible();
  });
});
