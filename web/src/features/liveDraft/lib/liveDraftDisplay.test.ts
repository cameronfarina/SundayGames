import { describe, expect, it } from "vitest";
import {
  draftProgress,
  filterBoard,
  filterSales,
  formatDollars,
  liveDraftStatusLabel,
  selectedTeamId,
} from "./liveDraftDisplay";
import { liveRoom } from "../test/liveDraftFixtures";
import type { LiveDraftRoom } from "../api/liveDraftSchemas";

describe("live draft display rules", () => {
  it("formats statuses and money for people", () => {
    const statuses: LiveDraftRoom["status"][] = [
      "setup", "countdown", "live", "paused", "ended",
    ];
    expect(statuses.map(liveDraftStatusLabel))
      .toEqual(["Not started", "Starting soon", "Live", "Paused", "Complete"]);
    expect(formatDollars(1234)).toBe("$1,234");
    expect(formatDollars(undefined)).toBe("-");
  });

  it("reports sales and filled roster progress", () => {
    expect(draftProgress(liveRoom)).toBe("1 sale · 1 of 4 spots filled");
    expect(draftProgress({ ...liveRoom, salesLog: [] })).toBe("0 sales · 1 of 4 spots filled");
  });

  it("filters the board by player, position, and team", () => {
    expect(filterBoard(liveRoom.board, "puka", "ALL")).toHaveLength(1);
    expect(filterBoard(liveRoom.board, "lar", "WR")).toHaveLength(1);
    expect(filterBoard(liveRoom.board, "puka", "RB")).toHaveLength(0);
    expect(filterBoard(liveRoom.board, "missing", "ALL")).toHaveLength(0);
    expect(filterBoard([{
      expectedPrice: 1,
      name: "Free Agent",
      normalizedPlayerName: "free agent",
      position: "RB",
    }], "agent", "ALL")).toHaveLength(1);
  });

  it("filters sales newest-first and resolves the initial team", () => {
    const firstSale = liveRoom.salesLog[0];
    if (firstSale === undefined) throw new Error("Expected a sale fixture.");
    const secondSale = { ...firstSale, saleEventId: "sale-2", playerName: "Puka Nacua" };
    expect(filterSales([...liveRoom.salesLog, secondSale], "puka"))
      .toEqual([secondSale]);
    expect(filterSales(liveRoom.salesLog, "50")).toEqual(liveRoom.salesLog);
    expect(selectedTeamId(liveRoom)).toBe("team-1");
    expect(selectedTeamId({
      ...liveRoom,
      selectedTeam: undefined,
      viewedTeam: undefined,
    })).toBe("team-1");
    expect(selectedTeamId({
      ...liveRoom,
      teamSummaries: [],
      selectedTeam: undefined,
      viewedTeam: undefined,
    }))
      .toBeUndefined();
  });
});
