import { describe, expect, it } from "vitest";
import { loadCurrentPlayerCatalog } from "../src/platform/localDemoFixtures.js";

describe("current player catalog valuation inputs", () => {
  it("exposes an immutable process-cached catalog", async () => {
    const catalog = await loadCurrentPlayerCatalog();

    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog[0])).toBe(true);
    expect(Object.isFrozen(catalog[0]?.seasonProjectionScoring)).toBe(true);
  });

  it("gives every loaded player a scoring-aware projection adjustment", async () => {
    const catalog = await loadCurrentPlayerCatalog();

    expect(catalog).toHaveLength(500);
    expect(catalog.every(player =>
      player.seasonProjectionAdjustmentFactor !== undefined
      && Number.isFinite(player.seasonProjectionAdjustmentFactor)
      && player.seasonProjectionAdjustmentFactor > 0
      && player.seasonProjectionScoring !== undefined
    )).toBe(true);
  });

  it("uses ESPN's published 2026 PPR auction values as the no-league baseline", async () => {
    const catalog = await loadCurrentPlayerCatalog();
    const valueFor = (name: string) => catalog.find(player => player.name === name)?.expectedPrice;

    expect(valueFor("Jahmyr Gibbs")).toBe(57);
    expect(valueFor("Ja'Marr Chase")).toBe(56);
    expect(valueFor("De'Von Achane")).toBe(50);
    expect(valueFor("Ladd McConkey")).toBe(17);
  });

  it("uses direct season-line calibration first and positional rank calibration elsewhere", async () => {
    const catalog = await loadCurrentPlayerCatalog();
    const player = (name: string) => catalog.find(candidate => candidate.name === name);

    expect(player("De'Von Achane")?.seasonProjectionAdjustmentFactor).toBeCloseTo(0.833, 3);
    expect(player("Josh Jacobs")?.seasonProjectionAdjustmentFactor).toBe(1.08);
    expect(player("Zay Flowers")?.seasonProjectionAdjustmentFactor).toBe(1.04);
    expect(player("Jalen Hurts")?.seasonProjectionAdjustmentFactor).toBe(1.02);
    expect(player("Mark Andrews")?.seasonProjectionAdjustmentFactor).toBe(1.05);
    expect(player("Ka'imi Fairbairn")?.seasonProjectionAdjustmentFactor).toBe(1.02);
    expect(player("Lions D/ST")?.seasonProjectionAdjustmentFactor).toBe(1.07);
  });
});
