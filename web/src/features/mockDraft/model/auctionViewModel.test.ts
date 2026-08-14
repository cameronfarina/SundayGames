import { describe, expect, it } from "vitest";
import { auctionMockResponseFixture } from "../test/auctionMockResponseFixture.js";
import {
  auctionProgress,
  filterAuctionPlayers,
  positionAccent,
  teamCanRoster,
} from "./auctionViewModel.js";

describe("auction view model", () => {
  const response = auctionMockResponseFixture();

  it("filters available players by position, flex eligibility, and search", () => {
    expect(filterAuctionPlayers(response.state.board.players, "", "RB").map(player => player.id))
      .toEqual(["gibbs"]);
    expect(filterAuctionPlayers(response.state.board.players, "lar", "ALL").map(player => player.id))
      .toEqual(["puka"]);
    expect(filterAuctionPlayers(response.state.board.players, "", "FLEX")).toHaveLength(2);
    expect(filterAuctionPlayers(response.state.board.players, "missing", "ALL")).toEqual([]);
  });

  it("derives roster eligibility and complete league progress", () => {
    const humanTeam = response.state.teams[0];
    expect(teamCanRoster(humanTeam, "RB")).toBe(true);
    expect(teamCanRoster(humanTeam, "QB")).toBe(false);
    expect(auctionProgress(response.state.teams)).toEqual({ completed: 1, total: 19 });
  });

  it("provides stable position accent names", () => {
    expect(positionAccent("QB")).toBe("position--qb");
    expect(positionAccent("RB")).toBe("position--rb");
    expect(positionAccent("WR")).toBe("position--wr");
    expect(positionAccent("TE")).toBe("position--te");
    expect(positionAccent("FLEX")).toBe("position--flex");
    expect(positionAccent("DST")).toBe("position--dst");
    expect(positionAccent("K")).toBe("position--k");
    expect(positionAccent("OTHER")).toBe("position--other");
  });
});
