import { describe, expect, it } from "vitest";
import { parseHistoricalImportSource } from "../../src/platform/historicalImportSource.js";

describe("wide-sheet historical import parsing", () => {
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
      { sourceRowNumber: 4, ownerDisplayName: "Owner11", playerName: "Mystery Player", priceDollars: 4 },
      { sourceRowNumber: 5, ownerDisplayName: "Owner12", position: "K", priceDollars: 2 },
    ]);
  });
});
