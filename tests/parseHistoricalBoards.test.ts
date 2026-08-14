import { describe, expect, it } from "vitest";
import { ownerOrder } from "../config/league.js";
import { parseHistoricalBoardCsv } from "../src/data/parseHistoricalBoards.js";

const header = (): string => [
  "Team",
  ...ownerOrder.flatMap(owner => [owner, "", ""]),
].join(",");

const rosterRow = (
  rowNumber: number,
  includedOwners: number = ownerOrder.length,
): string => [
  String(rowNumber),
  ...ownerOrder.flatMap((_, ownerIndex) => ownerIndex < includedOwners
    ? [
      ownerIndex === 0 ? "$1" : String(ownerIndex + 1),
      ownerIndex === 0 ? "DEF" : "RB",
      ownerIndex === 0 ? '"Seattle, Seahawks"' : `Player ${rowNumber}-${ownerIndex + 1}`,
    ]
    : ["", "", ""]),
].join(",");

const boardCsv = (rows: readonly string[]): string => [header(), ...rows].join("\n");

describe("parseHistoricalBoardCsv", () => {
  it("parses quoted names, normalizes DEF, marks keepers, and sorts records", () => {
    const records = parseHistoricalBoardCsv(
      boardCsv([rosterRow(2), rosterRow(1)]),
      { season: 2024, path: "/tmp/board.csv" },
    );

    expect(records).toHaveLength(ownerOrder.length * 2);
    expect(records[0]).toMatchObject({
      owner: ownerOrder[0],
      rosterRow: 1,
      originalPlayerName: "Seattle, Seahawks",
      normalizedPlayerName: "Seattle, Seahawks",
      position: "DST",
      price: 1,
      isKeeper: true,
      acquisitionType: "keeper",
      source: "board.csv",
    });
    expect(records[1]).toMatchObject({ rosterRow: 2, acquisitionType: "auction" });
  });

  it("rejects empty boards, unknown owners, malformed prices, and missing positions", () => {
    expect(() => parseHistoricalBoardCsv("", { season: 2024, path: "empty.csv" }))
      .toThrow("Historical board empty.csv is empty.");

    const unknownOwnerHeader = header().replace(ownerOrder[0] ?? "Owner01", "Unknown");
    expect(() => parseHistoricalBoardCsv(
      [unknownOwnerHeader, rosterRow(1)].join("\n"),
      { season: 2024, path: "owners.csv" },
    )).toThrow("Unknown historical board owner: Unknown");

    expect(() => parseHistoricalBoardCsv(
      boardCsv([rosterRow(1).replace("$1", "$1.5")]),
      { season: 2024, path: "price.csv" },
    )).toThrow("Invalid auction price: $1.5");

    expect(() => parseHistoricalBoardCsv(
      boardCsv([rosterRow(1).replace("DEF", "")]),
      { season: 2024, path: "position.csv" },
    )).toThrow("Missing price or position for Owner01 row 1 in position.csv.");
  });

  it("handles escaped quotes, blank player cells, and incomplete owner headers", () => {
    const escapedNameRow = rosterRow(1).replace(
      '"Seattle, Seahawks"',
      '"Seattle ""Seahawks"""',
    );
    const escapedNameRecords = parseHistoricalBoardCsv(
      boardCsv([escapedNameRow]),
      { season: 2024, path: "quotes.csv" },
    );
    expect(escapedNameRecords[0]?.originalPlayerName).toBe('Seattle "Seahawks"');

    const blankPlayerRecords = parseHistoricalBoardCsv(
      boardCsv([rosterRow(1).replace('"Seattle, Seahawks"', "")]),
      { season: 2024, path: "blank-player.csv" },
    );
    expect(blankPlayerRecords).toHaveLength(ownerOrder.length - 1);

    const shortHeader = [
      "Team",
      ...ownerOrder.slice(0, -1).flatMap(owner => [owner, "", ""]),
    ].join(",");
    expect(() => parseHistoricalBoardCsv(
      [shortHeader, rosterRow(1)].join("\n"),
      { season: 2024, path: "short.csv" },
    )).toThrow("Historical board short.csv has 13 owners; expected 14.");
  });

  it("repairs one missing 2023 final slot and rejects multiple missing slots", () => {
    const completeRows = Array.from({ length: 15 }, (_, index) => rosterRow(index + 1));
    const repaired = parseHistoricalBoardCsv(
      boardCsv([...completeRows, rosterRow(16, ownerOrder.length - 1)]),
      { season: 2023, path: "2023.csv" },
    );

    expect(repaired).toHaveLength(ownerOrder.length * 16);
    expect(repaired.at(-1)).toMatchObject({
      owner: ownerOrder.at(-1),
      rosterRow: 16,
      originalPlayerName: "Seattle Seahawks",
      acquisitionType: "post-draft waiver",
    });

    expect(() => parseHistoricalBoardCsv(
      boardCsv([...completeRows, rosterRow(16, ownerOrder.length - 2)]),
      { season: 2023, path: "broken.csv" },
    )).toThrow("Historical board broken.csv is missing multiple final roster slots.");
  });

  it("leaves complete 2023 boards intact and rejects duplicate repair players", () => {
    const completeRows = Array.from({ length: 16 }, (_, index) => rosterRow(index + 1));
    const complete = parseHistoricalBoardCsv(
      boardCsv(completeRows),
      { season: 2023, path: "complete.csv" },
    );
    expect(complete).toHaveLength(ownerOrder.length * 16);

    const firstFifteenRows = completeRows.slice(0, 15).map(row =>
      row.replace('"Seattle, Seahawks"', "Seattle Seahawks"));
    expect(() => parseHistoricalBoardCsv(
      boardCsv([...firstFifteenRows, rosterRow(16, ownerOrder.length - 1)]),
      { season: 2023, path: "duplicate.csv" },
    )).toThrow("Seattle Seahawks was already selected in 2023.");
  });
});
