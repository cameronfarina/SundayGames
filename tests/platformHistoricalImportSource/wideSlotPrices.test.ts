import { describe, expect, it } from "vitest";
import { parseHistoricalImportSource } from "../../src/platform/historicalImportSource.js";
import { slotPriceOwnerDisplayName } from "../../src/platform/historicalImports/slotPriceProvenance.js";

describe("wide slot price historical import parsing", () => {
  it("reads repeated position player price groups as ranked slot prices", () => {
    const result = parseHistoricalImportSource([
      "Position,Player,Price,Position,Player,Price,Position,Player,Price,Position,Player,Price",
      "RB,Bijan Robinson,$75,WR,Ja'Marr Chase,65,TE,Brock Bowers,35,QB,Josh Allen,35",
      "RB,Jahmyr Gibbs,$73,WR,Justin Jefferson,63,TE,Trey McBride,33,QB,Lamar Jackson,33",
      "RB,Saquon Barkley,$70,WR,CeeDee Lamb,61,,,,,,",
    ].join("\n"));

    expect(result.warnings).toEqual([]);
    expect(result.rows.map(row => row.playerName)).toEqual([
      "RB1", "WR1", "TE1", "QB1",
      "RB2", "WR2", "TE2", "QB2",
      "RB3", "WR3",
    ]);
    expect(result.rows.map(row => row.priceDollars)).toEqual([
      75, 65, 35, 35,
      73, 63, 33, 33,
      70, 61,
    ]);
    expect(result.rows.every(row => row.ownerDisplayName === slotPriceOwnerDisplayName)).toBe(true);
  });
});
