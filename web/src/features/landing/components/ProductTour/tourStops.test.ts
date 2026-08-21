import { describe, expect, it } from "vitest";
import { tourStops } from "./tourStops";

describe("tourStops", () => {
  it("walks from the league through to auction practice", () => {
    expect(tourStops.map(stop => stop.label))
      .toEqual(["League", "Values", "Simulations", "Plan", "Auction mock"]);
  });

  it("presents the auction screen as private practice, not a hosted live draft", () => {
    const auctionMock = tourStops.at(-1);

    expect(auctionMock?.label).toBe("Auction mock");
    expect(auctionMock?.alt).toMatch(/interactive auction mock/u);
    expect(auctionMock?.alt).not.toMatch(/live auction/u);
  });

  it("describes and pictures every stop", () => {
    for (const stop of tourStops) {
      expect(stop.alt.length).toBeGreaterThan(0);
      expect(stop.image.length).toBeGreaterThan(0);
    }
  });
});
