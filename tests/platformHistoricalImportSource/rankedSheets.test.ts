import { describe, expect, it } from "vitest";
import { parseHistoricalImportSource } from "../../src/platform/historicalImportSource.js";
import { slotPriceOwnerDisplayName } from "../../src/platform/historicalImports/slotPriceProvenance.js";

const parse = (lines: readonly string[]) =>
  parseHistoricalImportSource(lines.join("\n"));

describe("ranked price sheet parsing", () => {
  it("uses an ownerless ranked player sheet as positional pricing", () => {
    const result = parse([
      "Rank,Player,Position,Price",
      "1,Jahmyr Gibbs,RB,75",
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      ownerDisplayName: slotPriceOwnerDisplayName,
      playerName: "RB1",
      position: "RB",
      priceDollars: 75,
      publicPriceDollars: 57,
    });
  });

  it("honors a ranked player sheet's explicit public value", () => {
    const result = parse([
      "Rank,Player,Position,Price,Public Value",
      "1,Jahmyr Gibbs,RB,75,68",
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      ownerDisplayName: slotPriceOwnerDisplayName,
      playerName: "RB1",
      position: "RB",
      priceDollars: 75,
      publicPriceDollars: 68,
    });
  });
});
