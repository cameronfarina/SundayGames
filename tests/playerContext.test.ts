import { describe, expect, it } from "vitest";
import type { PlayerContextConfig } from "../config/playerContext.js";
import { calculatePlayerContextAdjustment } from "../src/modeling/playerContext.js";

const contextConfig: PlayerContextConfig = {
  enabled: true,
  maxAdjustment: 0.18,
  weights: {
    role: 0.08,
    injury: 0.07,
    contract: 0.03,
    coaching: 0.04,
    schedule: 0.03,
    bye: 0.02,
    opportunity: 0.06,
    defensiveAttention: 0.05,
    skillFit: 0.04,
    environment: 0.04,
    risk: 0.05,
  },
  overrides: [
    {
      player: "Example Player",
      signals: {
        role: -1,
        injury: -0.5,
        contract: 0.5,
        coaching: 1,
        schedule: -0.5,
        bye: -1,
      },
      notes: {
        role: "Committee risk.",
        coaching: "New play caller helps.",
      },
    },
  ],
};

describe("player context custom weights", () => {
  it("returns a neutral factor when custom weights are disabled", () => {
    expect(calculatePlayerContextAdjustment("Example Player", {
      ...contextConfig,
      enabled: false,
    })).toMatchObject({
      enabled: false,
      factor: 1,
      cappedAdjustment: 0,
    });
  });

  it("combines enabled manual category signals into one capped factor", () => {
    const adjustment = calculatePlayerContextAdjustment("Example Player", contextConfig);
    const override = contextConfig.overrides[0];
    if (override === undefined) throw new Error("Expected the player context fixture.");

    expect(adjustment.enabled).toBe(true);
    expect(adjustment.signals).toEqual(override.signals);
    expect(adjustment.notes).toEqual(override.notes);
    expect(adjustment.uncappedAdjustment).toBeCloseTo(-0.095);
    expect(adjustment.cappedAdjustment).toBeCloseTo(-0.095);
    expect(adjustment.factor).toBeCloseTo(0.905);
  });

  it("caps extreme custom-weight adjustments", () => {
    const adjustment = calculatePlayerContextAdjustment("Example Player", {
      ...contextConfig,
      maxAdjustment: 0.1,
      weights: {
        role: 0.5,
        injury: 0.5,
        contract: 0.5,
        coaching: 0.5,
        schedule: 0.5,
        bye: 0.5,
        opportunity: 0.5,
        defensiveAttention: 0.5,
        skillFit: 0.5,
        environment: 0.5,
        risk: 0.5,
      },
    });

    expect(adjustment.uncappedAdjustment).toBeLessThan(-0.1);
    expect(adjustment.cappedAdjustment).toBe(-0.1);
    expect(adjustment.factor).toBe(0.9);
  });

  it("can cap positive context more tightly than negative context", () => {
    const positiveAdjustment = calculatePlayerContextAdjustment("Positive Player", {
      ...contextConfig,
      maxPositiveAdjustment: 0.04,
      maxNegativeAdjustment: 0.18,
      overrides: [
        {
          player: "Positive Player",
          signals: {
            opportunity: 2,
            defensiveAttention: 1,
            skillFit: 2,
            environment: 2,
            risk: 1,
          },
        },
      ],
    });
    const negativeAdjustment = calculatePlayerContextAdjustment("Negative Player", {
      ...contextConfig,
      maxPositiveAdjustment: 0.04,
      maxNegativeAdjustment: 0.18,
      overrides: [
        {
          player: "Negative Player",
          signals: {
            opportunity: -2,
            defensiveAttention: -2,
            skillFit: -2,
            environment: -2,
            risk: -2,
          },
        },
      ],
    });

    expect(positiveAdjustment.uncappedAdjustment).toBeGreaterThan(0.04);
    expect(positiveAdjustment.cappedAdjustment).toBe(0.04);
    expect(negativeAdjustment.uncappedAdjustment).toBeLessThan(-0.04);
    expect(negativeAdjustment.cappedAdjustment).toBeLessThan(-0.04);
    expect(negativeAdjustment.cappedAdjustment).toBeGreaterThanOrEqual(-0.18);
  });

  it("includes factual evidence dimensions in the adjustment audit", () => {
    const adjustment = calculatePlayerContextAdjustment("Example Player", {
      ...contextConfig,
      overrides: [
        {
          player: "Example Player",
          signals: {
            opportunity: 1,
            defensiveAttention: -0.8,
            skillFit: -0.5,
            environment: 0.25,
          },
          evidence: [
            {
              player: "Example Player",
              category: "defensiveAttention",
              score: -1,
              confidence: 0.8,
              adjustedSignal: -0.8,
              source: "coverage",
              note: "Moves into WR1 coverage.",
            },
          ],
        },
      ],
    });

    expect(adjustment.uncappedAdjustment).toBeCloseTo(0.01);
    expect(adjustment.factor).toBeCloseTo(1.01);
    expect(adjustment.evidence).toEqual([
      {
        player: "Example Player",
        category: "defensiveAttention",
        score: -1,
        confidence: 0.8,
        adjustedSignal: -0.8,
        source: "coverage",
        note: "Moves into WR1 coverage.",
      },
    ]);
  });
});
