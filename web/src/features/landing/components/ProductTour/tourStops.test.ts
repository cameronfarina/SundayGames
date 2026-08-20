import { describe, expect, it } from "vitest";
import { tourStops } from "./tourStops";

describe("tourStops", () => {
  it("walks from the league through to the draft itself", () => {
    expect(tourStops.map(stop => stop.label))
      .toEqual(["League", "Values", "Simulations", "Plan", "Draft room"]);
  });

  it("describes and pictures every stop", () => {
    for (const stop of tourStops) {
      expect(stop.alt.length).toBeGreaterThan(0);
      expect(stop.image.length).toBeGreaterThan(0);
    }
  });
});
