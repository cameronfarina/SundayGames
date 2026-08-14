import { describe, expect, it } from "vitest";
import { parseHistoricalImportSource } from "../src/platform/historicalImportSource.js";

describe("platform historical import source parsing", () => {
  it("marks the first wide-sheet roster row as keepers only when requested", () => {
    const result = parseHistoricalImportSource([
      "Team,Owner11,,,Owner12,,",
      "Money Left,$0,,,$1,,",
      "Max Bid,$1,,,$2,,",
      "1,$50,RB,De'Von Achane,$3,DEF,New England Patriots",
      "2,$61,WR,Ja'Marr Chase,$2,K,Jake Elliott",
      "Spent,$111,,,$5,,",
      "Budget,$200,,,$200,,",
      "Available,$89,,,$195,,",
      "Slots,Selected,Available,0,Selected,Available,0",
      "QB,1,1,,0,1,",
    ].join("\n"), { inferFirstRosterRowAsKeeper: true });

    expect(result.warnings).toEqual([]);
    expect(result.rows).toEqual([
      {
        sourceRowNumber: 2,
        ownerDisplayName: "Owner11",
        playerName: "De'Von Achane",
        position: "RB",
        priceDollars: 50,
        keeper: true,
        acquisitionType: "keeper",
      },
      {
        sourceRowNumber: 3,
        ownerDisplayName: "Owner12",
        playerName: "New England Patriots",
        position: "DST",
        priceDollars: 3,
        keeper: true,
        acquisitionType: "keeper",
      },
      {
        sourceRowNumber: 4,
        ownerDisplayName: "Owner11",
        playerName: "Ja'Marr Chase",
        position: "WR",
        priceDollars: 61,
        keeper: false,
        acquisitionType: "auction",
      },
      {
        sourceRowNumber: 5,
        ownerDisplayName: "Owner12",
        playerName: "Jake Elliott",
        position: "K",
        priceDollars: 2,
        keeper: false,
        acquisitionType: "auction",
      },
    ]);
    expect(result.sourceRowCount).toBe(5);
  });

  it("does not assume the first roster row contains keepers", () => {
    const result = parseHistoricalImportSource([
      "Team,Owner11,,,Owner12,,",
      "1,$50,RB,De'Von Achane,$3,DEF,New England Patriots",
    ].join("\n"));

    expect(result.rows).toEqual([
      expect.not.objectContaining({ keeper: expect.any(Boolean) }),
      expect.not.objectContaining({ keeper: expect.any(Boolean) }),
    ]);
  });

  it("keeps incomplete wide-sheet player cells for downstream validation", () => {
    const result = parseHistoricalImportSource([
      "Team,Owner11,,,Owner12,,",
      "1,$50,RB,De'Von Achane,$3,DEF,New England Patriots",
      "2,$4,,Mystery Player,$2,K,",
    ].join("\n"));

    expect(result.rows).toEqual([
      expect.objectContaining({ ownerDisplayName: "Owner11", playerName: "De'Von Achane", position: "RB" }),
      expect.objectContaining({ ownerDisplayName: "Owner12", playerName: "New England Patriots", position: "DST" }),
      {
        sourceRowNumber: 4,
        ownerDisplayName: "Owner11",
        playerName: "Mystery Player",
        priceDollars: 4,
      },
      {
        sourceRowNumber: 5,
        ownerDisplayName: "Owner12",
        position: "K",
        priceDollars: 2,
      },
    ]);
  });

  it("keeps the existing row-oriented format and normalizes DEF to DST", () => {
    const result = parseHistoricalImportSource([
      "owner,player,position,price",
      "Owner11,New England Patriots,DEF,$3",
    ].join("\n"));

    expect(result.warnings).toEqual([]);
    expect(result.rows).toEqual([
      {
        sourceRowNumber: 2,
        ownerDisplayName: "Owner11",
        playerName: "New England Patriots",
        position: "DST",
        priceDollars: 3,
      },
    ]);
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
    expect(tabResult.rows).toEqual([
      {
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
      },
    ]);
    expect(semicolonResult.warnings).toEqual([]);
    expect(semicolonResult.rows).toEqual([
      {
        sourceRowNumber: 2,
        seasonYear: 2025,
        ownerDisplayName: "Owner12",
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
      "Owner11,\"Amon-Ra St. Brown, Jr.\",WR,\"$58\"",
    ].join("\n"));

    expect(result.warnings).toEqual([]);
    expect(result.rows).toEqual([
      {
        sourceRowNumber: 2,
        ownerDisplayName: "Owner11",
        playerName: "Amon-Ra St. Brown, Jr.",
        position: "WR",
        priceDollars: 58,
      },
    ]);
  });

  it("leaves blank and invalid prices undefined for downstream validation", () => {
    const result = parseHistoricalImportSource([
      "owner,player,position,price",
      "Owner11,Ja'Marr Chase,WR,",
      "Owner04,Christian McCaffrey,RB,free",
      "Owner12,Bijan Robinson,RB,1e2",
    ].join("\n"));

    expect(result.rows).toEqual([
      {
        sourceRowNumber: 2,
        ownerDisplayName: "Owner11",
        playerName: "Ja'Marr Chase",
        position: "WR",
      },
      {
        sourceRowNumber: 3,
        ownerDisplayName: "Owner04",
        playerName: "Christian McCaffrey",
        position: "RB",
      },
      {
        sourceRowNumber: 4,
        ownerDisplayName: "Owner12",
        playerName: "Bijan Robinson",
        position: "RB",
      },
    ]);
  });

  it("parses keeper booleans from commissioner-friendly tokens", () => {
    const result = parseHistoricalImportSource([
      "owner,player,position,price,keeper",
      "Owner11,Player 1,QB,1,true",
      "Owner11,Player 2,RB,2,yes",
      "Owner11,Player 3,WR,3,y",
      "Owner11,Player 4,TE,4,keeper",
      "Owner11,Player 5,K,5,1",
      "Owner11,Player 6,DST,6,false",
      "Owner11,Player 7,QB,7,no",
      "Owner11,Player 8,RB,8,n",
      "Owner11,Player 9,WR,9,auction",
      "Owner11,Player 10,TE,10,0",
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
      "Owner11,Ja'Marr Chase,WR,$62",
    ].join("\n");
    const withTrailingWhitespace = [
      "owner,player,position,price   ",
      "Owner11,Ja'Marr Chase,WR,$62   ",
      "",
      "",
    ].join("\n");

    expect(parseHistoricalImportSource(base).fileHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(parseHistoricalImportSource(withTrailingWhitespace).fileHash).toBe(
      parseHistoricalImportSource(base).fileHash,
    );
  });

  it("rejects delimited sources that exceed row or cell limits", () => {
    const csv = [
      "owner,player,position,price",
      "Owner11,Player One,RB,1",
      "Owner12,Player Two,WR,2",
    ].join("\n");
    const tsv = [
      "owner\tplayer\tposition\tprice",
      "Owner11\tPlayer One\tRB\t1",
    ].join("\n");

    expect(() => parseHistoricalImportSource(csv, { maxRows: 2, maxCells: 100 }))
      .toThrow("Historical draft files may contain at most 2 rows.");
    expect(() => parseHistoricalImportSource(tsv, { maxRows: 10, maxCells: 7 }))
      .toThrow("Historical draft files may contain at most 7 cells.");
  });
});
