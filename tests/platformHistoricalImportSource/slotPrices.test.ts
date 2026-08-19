import { describe, expect, it } from "vitest";
import { parseHistoricalImportSource } from "../../src/platform/historicalImportSource.js";
import { slotPriceOwnerDisplayName } from "../../src/platform/historicalImports/slotPriceProvenance.js";

const parse = (lines: readonly string[]) =>
  parseHistoricalImportSource(lines.join("\n"));

describe("slot price historical import parsing", () => {
  it("reads a position, a rank and a price into a slot sale", () => {
    const result = parse([
      "Position,Rank,Price",
      "RB,1,75",
      "WR,2,60",
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.rows).toEqual([
      {
        sourceRowNumber: 2,
        ownerDisplayName: slotPriceOwnerDisplayName,
        playerName: "RB1",
        position: "RB",
        priceDollars: 75,
        publicPriceDollars: 57,
        keeper: false,
        acquisitionType: "auction",
      },
      {
        sourceRowNumber: 3,
        ownerDisplayName: slotPriceOwnerDisplayName,
        playerName: "WR2",
        position: "WR",
        priceDollars: 60,
        publicPriceDollars: 55,
        keeper: false,
        acquisitionType: "auction",
      },
    ]);
  });

  it("reads a slot written as one cell", () => {
    const result = parse(["Slot,Price", "RB1,$75", "WR 2,60", "TE-3,$13"]);

    expect(result.rows.map(row => [row.playerName, row.priceDollars, row.publicPriceDollars]))
      .toEqual([["RB1", 75, 57], ["WR2", 60, 55], ["TE3", 13, 13]]);
  });

  it("keeps a season column so one sheet can carry several drafts", () => {
    const result = parse(["Slot,Price,Season", "RB1,75,2024", "RB1,68,2023"]);

    expect(result.rows.map(row => row.seasonYear)).toEqual([2024, 2023]);
  });

  it("names no owner it could be confused with, and never a real player", () => {
    const result = parse(["Slot,Price", "RB1,75"]);

    expect(result.rows[0]?.ownerDisplayName).toBe(slotPriceOwnerDisplayName);
    expect(result.rows[0]?.playerName).toBe("RB1");
  });

  it("marks every slot an auction sale rather than leaving it inferred", () => {
    const result = parse(["Slot,Price", "RB1,75"]);

    expect(result.rows[0]).toMatchObject({ keeper: false, acquisitionType: "auction" });
  });

  it("leaves a slot deeper than the published board without a published value", () => {
    const result = parse(["Slot,Price", "RB1,75", "TE30,3", "RB90,1"]);

    expect(result.rows[0]?.publicPriceDollars).toBe(57);
    expect(result.rows[1]).not.toHaveProperty("publicPriceDollars");
    expect(result.rows[2]).not.toHaveProperty("publicPriceDollars");
  });

  it("keeps kicker and defense slots without giving them a published value", () => {
    const result = parse(["Slot,Price", "K1,2", "DST1,3", "DEF2,2", "D/ST3,2"]);

    expect(result.rows.map(row => [row.position, row.playerName, row.priceDollars]))
      .toEqual([["K", "K1", 2], ["DST", "DST1", 3], ["DST", "DST2", 2], ["DST", "DST3", 2]]);
    expect(result.rows.every(row => row.publicPriceDollars === undefined)).toBe(true);
  });

  it("warns about a row with no readable rank and leaves it unnamed", () => {
    const result = parse(["Slot,Price", "RB1,75", "Bench,20"]);

    expect(result.warnings).toEqual([{
      code: "invalid_position_rank",
      message: 'Row 3 has no position rank in "Bench". Name a slot such as RB1, or give a position column and a rank column.',
      rowNumber: 3,
      column: "positionRank",
    }]);
    expect(result.rows[1]).not.toHaveProperty("playerName");
  });

  it("keeps an unreadable price for the row validation to reject", () => {
    const result = parse(["Slot,Price", "RB1,tbd"]);

    expect(result.rows[0]).not.toHaveProperty("priceDollars");
  });

  it("skips a blank row without warning about it", () => {
    const result = parse(["Slot,Price", "RB1,75", ",", "WR1,70"]);

    expect(result.warnings).toEqual([]);
    expect(result.rows.map(row => row.playerName)).toEqual(["RB1", "WR1"]);
  });

  it("reads tab separated slot prices", () => {
    const result = parse(["Slot\tPrice", "RB1\t75"]);

    expect(result.rows.map(row => [row.playerName, row.priceDollars])).toEqual([["RB1", 75]]);
  });

  it("leaves a sheet that names players to the header-mapped layout", () => {
    const result = parse([
      "Owner,Player,Position,Price,Rank",
      "Owner One,Jahmyr Gibbs,RB,75,1",
    ]);

    expect(result.rows[0]).toMatchObject({
      ownerDisplayName: "Owner One",
      playerName: "Jahmyr Gibbs",
    });
  });

  it("leaves a wide auction sheet to the wide layout", () => {
    const result = parse([
      "Team,Owner11,,,Owner12,,",
      "1,$50,RB,De'Von Achane,$3,WR,Ja'Marr Chase",
    ]);

    expect(result.rows.map(row => row.ownerDisplayName)).toEqual(["Owner11", "Owner12"]);
  });
});
