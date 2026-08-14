import { describe, expect, it } from "vitest";
import { parseHistoricalImportSource } from "../../src/platform/historicalImportSource.js";

describe("historical import source validation", () => {
  it("leaves blank and invalid prices undefined for downstream validation", () => {
    const result = parseHistoricalImportSource([
      "owner,player,position,price",
      "Owner11,Ja'Marr Chase,WR,",
      "Owner04,Christian McCaffrey,RB,free",
      "Owner12,Bijan Robinson,RB,1e2",
    ].join("\n"));
    expect(result.rows).toEqual([
      { sourceRowNumber: 2, ownerDisplayName: "Owner11", playerName: "Ja'Marr Chase", position: "WR" },
      { sourceRowNumber: 3, ownerDisplayName: "Owner04", playerName: "Christian McCaffrey", position: "RB" },
      { sourceRowNumber: 4, ownerDisplayName: "Owner12", playerName: "Bijan Robinson", position: "RB" },
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
      true, true, true, true, true, false, false, false, false, false,
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
