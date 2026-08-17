import { describe, expect, it } from "vitest";
import {
  maximumSimulationNoteLength,
  maximumSimulationStrategyTextLength,
} from "../src/platform/simulationLimits.js";
import {
  seasonSimulationTextInputFromUnknown,
  simulationStrategyInputFromUnknown,
} from "../src/platform/simulationHttpInput.js";
import { SimulationError } from "../src/platform/simulations.js";

describe("simulation HTTP input", () => {
  it("parses a legitimate structured strategy without type assertions", () => {
    expect(simulationStrategyInputFromUnknown({
      hardLocks: [{
        playerName: "Jadarian Price",
        price: 15,
        priceMode: "ceiling",
        auctionOwner: "Seth",
      }],
      softTargets: [{
        label: "Elite RB",
        candidatePool: ["Jahmyr Gibbs", "Bijan Robinson"],
        maxBid: 78,
      }],
    })).toEqual({
      hardLocks: [{
        playerName: "Jadarian Price",
        price: 15,
        priceMode: "ceiling",
        auctionOwner: "Seth",
      }],
      softTargets: [{
        label: "Elite RB",
        candidatePool: ["Jahmyr Gibbs", "Bijan Robinson"],
        maxBid: 78,
      }],
    });
  });

  it("rejects an auction owner that names nobody", () => {
    for (const auctionOwner of ["", "   ", 11]) {
      expect(() => simulationStrategyInputFromUnknown({
        hardLocks: [{ playerName: "Jadarian Price", price: 15, auctionOwner }],
      })).toThrow(new SimulationError(
        "invalid_simulation_strategy",
        "Hard-lock auctionOwner must name a team manager.",
      ));
    }
  });

  it("rejects malformed structured strategy fields", () => {
    expect(() => simulationStrategyInputFromUnknown({ hardLocks: "many" })).toThrow(
      new SimulationError(
        "invalid_simulation_strategy",
        "Simulation strategy must use hardLocks and softTargets arrays.",
      ),
    );
    expect(() => simulationStrategyInputFromUnknown({
      hardLocks: [{ playerName: "Jahmyr Gibbs", price: "78" }],
    })).toThrow(new SimulationError(
      "invalid_simulation_strategy",
      "Each hard lock must include a player name and numeric price.",
    ));
    expect(() => simulationStrategyInputFromUnknown({
      softTargets: [{ label: "RB", candidatePool: ["Gibbs", 7], maxBid: 78 }],
    })).toThrow(new SimulationError(
      "invalid_simulation_strategy",
      "Each soft-target candidate must be a player name.",
    ));
  });

  it("bounds season strategy text and notes instead of silently truncating them", () => {
    expect(() => seasonSimulationTextInputFromUnknown({
      strategy: "s".repeat(maximumSimulationStrategyTextLength + 1),
      note: "",
    })).toThrow(new SimulationError(
      "simulation_strategy_too_large",
      `Simulation strategy text cannot exceed ${maximumSimulationStrategyTextLength} characters.`,
    ));
    expect(() => seasonSimulationTextInputFromUnknown({
      strategy: "balanced",
      note: "n".repeat(maximumSimulationNoteLength + 1),
    })).toThrow(new SimulationError(
      "simulation_strategy_too_large",
      `Simulation note cannot exceed ${maximumSimulationNoteLength} characters.`,
    ));
    expect(seasonSimulationTextInputFromUnknown({
      strategy: "  target Gibbs  ",
      note: "  Compare builds.  ",
    })).toEqual({ strategy: "target Gibbs", note: "Compare builds." });
  });
});
