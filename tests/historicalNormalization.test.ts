import { describe, expect, it } from "vitest";
import { ownerOrder } from "../config/league.js";
import {
  historicalBoardFiles,
  historicalBoardFilesForEnvironment,
  loadHistoricalAuctionRecords,
} from "../src/data/parseHistoricalBoards.js";
import {
  canonicalPlayerIdentityKey,
  normalizePlayerName,
} from "../src/data/normalizePlayerName.js";

const sumPrices = (records: { price: number }[]): number =>
  records.reduce((total, record) => total + record.price, 0);

describe("historical board normalization", () => {
  it("loads the league boards with verified owner order, keeper rows, and spending totals", async () => {
    const records = await loadHistoricalAuctionRecords(historicalBoardFiles);

    for (const { season } of historicalBoardFiles) {
      const seasonRecords = records.filter(record => record.season === season);
      const visibleDraftRecords = seasonRecords.filter(record => record.acquisitionType !== "post-draft waiver");

      expect([...new Set(seasonRecords.map(record => record.owner))]).toEqual(ownerOrder);
      expect(seasonRecords.filter(record => record.isKeeper)).toHaveLength(14);
      expect(seasonRecords.filter(record => record.rosterRow === 1).every(record => record.isKeeper)).toBe(true);
      expect(seasonRecords.map(record => String(record.position))).not.toContain("DEF");

      for (const owner of ownerOrder) {
        expect(seasonRecords.filter(record => record.owner === owner)).toHaveLength(16);
      }

      if (season === 2023) {
        expect(visibleDraftRecords).toHaveLength(223);
        expect(sumPrices(visibleDraftRecords)).toBe(2796);
        expect(sumPrices(seasonRecords)).toBe(2797);
        expect(
          seasonRecords.find(record => record.acquisitionType === "post-draft waiver"),
        ).toMatchObject({
          originalPlayerName: "Seattle Seahawks",
          normalizedPlayerName: "Seattle Seahawks",
          position: "DST",
          price: 1,
          isKeeper: false,
          acquisitionType: "post-draft waiver",
        });
      } else {
        expect(visibleDraftRecords).toHaveLength(224);
        expect(sumPrices(seasonRecords)).toBe(season === 2024 ? 2798 : 2797);
      }
    }
  });

  it("normalizes common player aliases while preserving original names on records", async () => {
    expect(normalizePlayerName("Deebo Samuel Sr.")).toBe("Deebo Samuel");
    expect(normalizePlayerName("Patrick Mahomes II")).toBe("Patrick Mahomes");
    expect(normalizePlayerName("Brian Robinson Jr.")).toBe("Brian Robinson");
    expect(normalizePlayerName("Devon Achane")).toBe("De'Von Achane");
    expect(normalizePlayerName("D.J. Moore")).toBe("DJ Moore");
    expect(normalizePlayerName("Sam LaPorta\u00a0")).toBe("Sam LaPorta");
    expect(normalizePlayerName("James Cook III")).toBe("James Cook");
    expect(canonicalPlayerIdentityKey("  JAMES cook iii. ")).toBe(
      canonicalPlayerIdentityKey("James Cook"),
    );

    const records = await loadHistoricalAuctionRecords(historicalBoardFiles);
    const deebo2025 = records.find(record => record.season === 2025 && record.originalPlayerName === "Deebo Samuel Sr.");

    expect(deebo2025).toMatchObject({
      originalPlayerName: "Deebo Samuel Sr.",
      normalizedPlayerName: "Deebo Samuel",
    });
  });

  it("uses synthetic fixtures unless a private source directory is explicitly configured", () => {
    expect(historicalBoardFiles.map(board => board.path)).toEqual([
      "data/fixtures/historical/auction-2023.synthetic.csv",
      "data/fixtures/historical/auction-2024.synthetic.csv",
      "data/fixtures/historical/auction-2025.synthetic.csv",
    ]);
    expect(historicalBoardFilesForEnvironment({
      MOCKD_HISTORICAL_BOARD_DIRECTORY: "/private/mockd",
    })).toEqual([
      { season: 2023, path: "/private/mockd/2023-board.csv" },
      { season: 2024, path: "/private/mockd/2024-board.csv" },
      { season: 2025, path: "/private/mockd/2025-board.csv" },
    ]);
  });
});
