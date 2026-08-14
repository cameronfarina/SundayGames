import { describe, expect, it } from "vitest";
import { parseHistoricalImportSource } from "../../src/platform/historicalImportSource.js";

describe("delimited historical import parsing", () => {
  it("keeps the existing row-oriented format and normalizes DEF to DST", () => {
    const result = parseHistoricalImportSource([
      "owner,player,position,price",
      "Owner11,New England Patriots,DEF,$3",
    ].join("\n"));
    expect(result.warnings).toEqual([]);
    expect(result.rows).toEqual([{
      sourceRowNumber: 2,
      ownerDisplayName: "Owner11",
      playerName: "New England Patriots",
      position: "DST",
      priceDollars: 3,
    }]);
  });

  it("auto-detects tab and semicolon delimiters from alias headers", () => {
    const tabResult = parseHistoricalImportSource([
      "team\tname\tposition\tamount\tespn aav\tyear\tplayer id\tis keeper\tacquisition",
      " Owner11 \t Ja'Marr Chase \t WR \t $62 \t $55 \t 2025 \t player-jamarr-chase \t y \t keeper ",
    ].join("\n"));
    const semicolonResult = parseHistoricalImportSource([
      "owner name;player name;pos;salary;season year;espn id;type",
      "Owner12;Bijan Robinson;RB;62.0;2025;espn-bijan;auction",
    ].join("\n"));

    expect(tabResult.warnings).toEqual([]);
    expect(tabResult.sourceRowCount).toBe(2);
    expect(tabResult.rows).toEqual([{
      sourceRowNumber: 2,
      seasonYear: 2025,
      ownerDisplayName: "Owner11",
      playerName: "Ja'Marr Chase",
      playerId: "player-jamarr-chase",
      position: "WR",
      priceDollars: 62,
      publicPriceDollars: 55,
      keeper: true,
      acquisitionType: "keeper",
    }]);
    expect(semicolonResult.warnings).toEqual([]);
    expect(semicolonResult.rows).toEqual([{
      sourceRowNumber: 2,
      seasonYear: 2025,
      ownerDisplayName: "Owner12",
      playerName: "Bijan Robinson",
      playerId: "espn-bijan",
      position: "RB",
      priceDollars: 62,
      acquisitionType: "auction",
    }]);
  });

  it("parses quoted CSV cells without splitting embedded delimiters", () => {
    const result = parseHistoricalImportSource([
      "owner,player,position,price",
      "Owner11,\"Amon-Ra St. Brown, Jr.\",WR,\"$58\"",
    ].join("\n"));
    expect(result.warnings).toEqual([]);
    expect(result.rows).toEqual([{
      sourceRowNumber: 2,
      ownerDisplayName: "Owner11",
      playerName: "Amon-Ra St. Brown, Jr.",
      position: "WR",
      priceDollars: 58,
    }]);
  });
});
