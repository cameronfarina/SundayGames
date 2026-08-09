import { describe, expect, it } from "vitest";
import { parseHistoricalImportSource } from "../src/platform/historicalImportSource.js";

describe("platform historical import source parsing", () => {
  it("auto-detects tab and semicolon delimiters from alias headers", () => {
    const tabResult = parseHistoricalImportSource([
      "team\tname\tposition\tamount\tyear\tplayer id\tis keeper\tacquisition",
      " Cam \t Ja'Marr Chase \t WR \t $62 \t 2025 \t player-jamarr-chase \t y \t keeper ",
    ].join("\n"));
    const semicolonResult = parseHistoricalImportSource([
      "owner name;player name;pos;salary;season year;espn id;type",
      "Sam;Bijan Robinson;RB;62.0;2025;espn-bijan;auction",
    ].join("\n"));

    expect(tabResult.warnings).toEqual([]);
    expect(tabResult.sourceRowCount).toBe(2);
    expect(tabResult.rows).toEqual([
      {
        sourceRowNumber: 2,
        seasonYear: 2025,
        ownerDisplayName: "Cam",
        playerName: "Ja'Marr Chase",
        playerId: "player-jamarr-chase",
        position: "WR",
        priceDollars: 62,
        keeper: true,
        acquisitionType: "keeper",
      },
    ]);
    expect(semicolonResult.warnings).toEqual([]);
    expect(semicolonResult.rows).toEqual([
      {
        sourceRowNumber: 2,
        seasonYear: 2025,
        ownerDisplayName: "Sam",
        playerName: "Bijan Robinson",
        playerId: "espn-bijan",
        position: "RB",
        priceDollars: 62,
        acquisitionType: "auction",
      },
    ]);
  });

  it("parses quoted CSV cells without splitting embedded delimiters", () => {
    const result = parseHistoricalImportSource([
      "owner,player,position,price",
      "Cam,\"Amon-Ra St. Brown, Jr.\",WR,\"$58\"",
    ].join("\n"));

    expect(result.warnings).toEqual([]);
    expect(result.rows).toEqual([
      {
        sourceRowNumber: 2,
        ownerDisplayName: "Cam",
        playerName: "Amon-Ra St. Brown, Jr.",
        position: "WR",
        priceDollars: 58,
      },
    ]);
  });

  it("leaves blank and invalid prices undefined for downstream validation", () => {
    const result = parseHistoricalImportSource([
      "owner,player,position,price",
      "Cam,Ja'Marr Chase,WR,",
      "Seth,Christian McCaffrey,RB,free",
      "Sam,Bijan Robinson,RB,1e2",
    ].join("\n"));

    expect(result.rows).toEqual([
      {
        sourceRowNumber: 2,
        ownerDisplayName: "Cam",
        playerName: "Ja'Marr Chase",
        position: "WR",
      },
      {
        sourceRowNumber: 3,
        ownerDisplayName: "Seth",
        playerName: "Christian McCaffrey",
        position: "RB",
      },
      {
        sourceRowNumber: 4,
        ownerDisplayName: "Sam",
        playerName: "Bijan Robinson",
        position: "RB",
      },
    ]);
  });

  it("parses keeper booleans from commissioner-friendly tokens", () => {
    const result = parseHistoricalImportSource([
      "owner,player,position,price,keeper",
      "Cam,Player 1,QB,1,true",
      "Cam,Player 2,RB,2,yes",
      "Cam,Player 3,WR,3,y",
      "Cam,Player 4,TE,4,keeper",
      "Cam,Player 5,K,5,1",
      "Cam,Player 6,DST,6,false",
      "Cam,Player 7,QB,7,no",
      "Cam,Player 8,RB,8,n",
      "Cam,Player 9,WR,9,auction",
      "Cam,Player 10,TE,10,0",
    ].join("\n"));

    expect(result.rows.map(row => row.keeper)).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("uses a stable sha256 file hash across trailing source whitespace", () => {
    const base = [
      "owner,player,position,price",
      "Cam,Ja'Marr Chase,WR,$62",
    ].join("\n");
    const withTrailingWhitespace = [
      "owner,player,position,price   ",
      "Cam,Ja'Marr Chase,WR,$62   ",
      "",
      "",
    ].join("\n");

    expect(parseHistoricalImportSource(base).fileHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(parseHistoricalImportSource(withTrailingWhitespace).fileHash).toBe(
      parseHistoricalImportSource(base).fileHash,
    );
  });
});
