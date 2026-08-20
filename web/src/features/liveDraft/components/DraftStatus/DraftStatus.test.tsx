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
    expect(screen.getByText("De'Von Achane to Owner11 for $50")).toBeVisible();
  });

  it("shows a useful empty latest-sale state", () => {
    render(<DraftStatus connection="polling" room={{ ...liveRoom, salesLog: [] }} />);
    expect(screen.getByText("Polling")).toBeVisible();
    expect(screen.getByText("No sales yet")).toBeVisible();
  });

  it("describes price-less snake picks without auction language", () => {
    const [sale] = liveRoom.salesLog;
    if (sale === undefined) throw new Error("Expected a sale fixture.");
    render(<DraftStatus connection="connected" room={{
      ...liveRoom,
      picks: [{
        overall: 1,
        round: 1,
        pickInRound: 1,
        teamId: "team-1",
        ownerDisplayName: "Owner11",
        teamDisplayName: "Short King",
        playerName: "De'Von Achane",
        source: "sale",
        saleEventId: "sale-1",
      }],
      salesLog: [{ ...sale, price: undefined }],
    }} />);

    expect(screen.getByText("1 pick · 1 of 4 spots filled")).toBeVisible();
    expect(screen.getByText("Latest pick")).toBeVisible();
    expect(screen.getByText("De'Von Achane to Owner11")).toBeVisible();
    expect(screen.queryByText(/Latest sale|for -/)).not.toBeInTheDocument();
  });
});
