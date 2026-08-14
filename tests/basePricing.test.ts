import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { customWeightsPlayerContextConfig } from "../config/playerContext.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import { loadPlayerContextEvidenceOverrides } from "../src/data/playerContextEvidenceImports.js";
import { mergePlayerContextOverrides } from "../src/data/playerContextImports.js";
import { buildBasePrices, defaultPricingConfig, summarizePricePool } from "../src/modeling/basePricing.js";
import { applyKeeperScenarioToPrices, buildKeeperScenarios } from "../src/modeling/keeperInflation.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
const initialEvidencePath = "data/raw/player-evidence-2026-initial.csv";

const expectPriceBetween = (actual: number, low: number, high: number): void => {
  expect(actual).toBeGreaterThanOrEqual(low);
  expect(actual).toBeLessThanOrEqual(high);
};

const defined = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`Expected ${label}.`);
  return value;
};

describe("audited base pricing", () => {
  it("reconciles public anchor prices to the configured league market", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const prices = buildBasePrices(projections, historicalRecords);
    const summary = summarizePricePool(prices);

    expect(summary.counts).toEqual(defaultPricingConfig.draftedPoolCounts);
    expect(summary.spend).toEqual(defaultPricingConfig.auditedSpendTargets);

    for (const price of prices) {
      expect(price.price).toBeGreaterThanOrEqual(1);
      expect(price.price).toBeLessThanOrEqual(defaultPricingConfig.hardPriceCeilings[price.position]);
      expect(price.rankGapAdjustment).toBeGreaterThanOrEqual(0.88);
      expect(price.rankGapAdjustment).toBeLessThanOrEqual(1.12);
      expect(price.marketPressure).toBeGreaterThanOrEqual(0.97);
      expect(price.marketPressure).toBeLessThanOrEqual(1.05);
    }
  });

  it("keeps known audited examples in realistic league-specific ranges", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const byName = new Map(
      buildBasePrices(projections, historicalRecords).map(price => [price.name, price]),
    );

    expectPriceBetween(defined(byName.get("Jahmyr Gibbs"), "Jahmyr Gibbs price").price, 68, 72);
    expectPriceBetween(defined(byName.get("Bijan Robinson"), "Bijan Robinson price").price, 67, 71);
    expectPriceBetween(defined(byName.get("Puka Nacua"), "Puka Nacua price").price, 67, 71);
    expectPriceBetween(defined(byName.get("Ja'Marr Chase"), "Ja'Marr Chase price").price, 66, 70);
    expectPriceBetween(defined(byName.get("Jaxon Smith-Njigba"), "Jaxon Smith-Njigba price").price, 66, 70);
    expectPriceBetween(defined(byName.get("Christian McCaffrey"), "Christian McCaffrey price").price, 64, 69);
    expectPriceBetween(defined(byName.get("Amon-Ra St. Brown"), "Amon-Ra St. Brown price").price, 63, 68);
    expectPriceBetween(defined(byName.get("CeeDee Lamb"), "CeeDee Lamb price").price, 61, 66);
    expect(defined(byName.get("Josh Allen"), "Josh Allen price").price).toBe(35);
    expect(defined(byName.get("Trey McBride"), "Trey McBride price").price).toBe(38);

    const jadarian = defined(byName.get("Jadarian Price"), "Jadarian Price price");
    expect(Math.round(jadarian.preSustainabilityPrice)).toBe(22);
    expect(jadarian.sustainabilityFactor).toBe(0.68);
    expect(jadarian.price).toBe(15);
  });

  it("protects historically expensive same-player RBs from soft public anchors", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const prices = buildBasePrices(projections, historicalRecords);
    const byName = new Map(prices.map(price => [price.name, price]));
    const expectedScenario = buildKeeperScenarios(keepers).find(scenario => scenario.key === "expected");
    if (!expectedScenario) throw new Error("Expected keeper scenario was not found.");
    const availableByName = new Map(
      applyKeeperScenarioToPrices(prices, expectedScenario, keepers)
        .availablePrices
        .map(price => [price.name, price]),
    );

    const barkley = defined(byName.get("Saquon Barkley"), "Saquon Barkley price");
    const jeanty = defined(byName.get("Ashton Jeanty"), "Ashton Jeanty price");
    const jacobs = defined(byName.get("Josh Jacobs"), "Josh Jacobs price");

    expect(barkley.historicalRoomPrice).toBeGreaterThanOrEqual(68);
    expect(barkley.historicalRoomFloor).toBeGreaterThanOrEqual(58);
    expect(barkley.price).toBeGreaterThanOrEqual(58);
    expect(availableByName.get("Saquon Barkley")?.scenarioPrice).toBeGreaterThanOrEqual(60);

    expect(jeanty.historicalRoomPrice).toBe(56);
    expect(jeanty.price).toBeGreaterThanOrEqual(52);
    expect(availableByName.has("Ashton Jeanty")).toBe(false);

    expect(jacobs.historicalRoomPrice).toBeGreaterThanOrEqual(46);
    expect(jacobs.price).toBeGreaterThanOrEqual(41);
  });

  it("can turn on custom player-context weights while preserving spend reconciliation", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const defaultPrices = buildBasePrices(projections, historicalRecords);
    const customPrices = buildBasePrices(projections, historicalRecords, {
      ...defaultPricingConfig,
      playerContext: {
        ...customWeightsPlayerContextConfig,
        overrides: [
          {
            player: "Puka Nacua",
            signals: {
              role: -2,
              injury: -1,
            },
            notes: {
              role: "Synthetic test signal for custom-weight repricing.",
            },
          },
        ],
      },
    });
    const defaultPuka = defined(defaultPrices.find(price => price.name === "Puka Nacua"), "default Puka price");
    const customPuka = defined(customPrices.find(price => price.name === "Puka Nacua"), "custom Puka price");

    expect(summarizePricePool(customPrices).spend).toEqual(defaultPricingConfig.auditedSpendTargets);
    expect(defaultPuka.contextAdjustmentFactor).toBe(1);
    expect(customPuka.contextAdjustmentFactor).toBeLessThan(1);
    expect(customPuka.rawPrice).toBeLessThan(defaultPuka.rawPrice);
    expect(customPuka.price).toBeLessThan(defaultPuka.price);
  });

  it("keeps evidence-driven top-price volume inside historical league bounds", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const evidenceOverrides = await loadPlayerContextEvidenceOverrides(initialEvidencePath);
    const prices = buildBasePrices(projections, historicalRecords, {
      ...defaultPricingConfig,
      playerContext: {
        ...customWeightsPlayerContextConfig,
        overrides: mergePlayerContextOverrides(
          customWeightsPlayerContextConfig.overrides,
          evidenceOverrides,
        ),
      },
    });
    const expectedScenario = buildKeeperScenarios(keepers).find(scenario => scenario.key === "expected");
    if (!expectedScenario) throw new Error("Expected keeper scenario was not found.");
    const availablePrices = applyKeeperScenarioToPrices(prices, expectedScenario, keepers).availablePrices;

    expect(summarizePricePool(prices).spend).toEqual(defaultPricingConfig.auditedSpendTargets);
    expect(prices.filter(price => price.price >= 67).length).toBeLessThanOrEqual(5);
    expect(prices.filter(price => price.price >= 72).length).toBeLessThanOrEqual(3);
    expect(prices.filter(price => price.price >= 77).length).toBeLessThanOrEqual(1);
    expect(availablePrices.filter(price => price.scenarioPrice >= 70).length).toBeLessThanOrEqual(5);
    expect(availablePrices.filter(price => price.scenarioPrice >= 75).length).toBeLessThanOrEqual(3);
    expect(availablePrices.filter(price => price.scenarioPrice >= 80).length).toBeLessThanOrEqual(1);
  });

  it("spreads rounding dollars instead of dumping them into one player", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const customPrices = buildBasePrices(projections, historicalRecords, {
      ...defaultPricingConfig,
      playerContext: {
        ...customWeightsPlayerContextConfig,
        overrides: [
          ...customWeightsPlayerContextConfig.overrides,
          {
            player: "Puka Nacua",
            signals: {
              role: -2,
              injury: -1,
            },
          },
          {
            player: "Malik Nabers",
            signals: {
              role: 1,
              bye: -0.25,
            },
          },
        ],
      },
    });
    const london = defined(customPrices.find(price => price.name === "Drake London"), "Drake London price");

    expect(london.rawPrice).toBeLessThan(60);
    expect(london.price).toBeLessThanOrEqual(56);
  });

  it("preserves a realistic one-dollar shelf after integer rounding", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const prices = buildBasePrices(projections, historicalRecords);

    const oneDollarCount = prices.filter(price => price.price === 1).length;

    expect(oneDollarCount).toBeGreaterThanOrEqual(70);
    expect(oneDollarCount).toBeLessThanOrEqual(75);
  });
});
