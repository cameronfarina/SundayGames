import { describe, expect, it } from "vitest";
import {
  DraftExportError,
  draftExportSlotOrder,
  generateDraftExport,
} from "../src/platform/draftExport.js";

const exportedAt = new Date("2026-08-09T14:30:00.000Z");

const baseState = {
  leagueName: "League 214674",
  seasonYear: 2026,
  draftRoomId: "room_abc",
  exportedAt,
  status: "in_progress",
  revision: 7,
  teams: [
    {
      teamId: "team_cam",
      teamName: "Cam's Team",
      ownerName: "Cam",
      draftOrderPosition: 2,
      slots: [
        {
          slot: "WR1",
          player: {
            name: "Puka Nacua",
            price: 62,
            source: "auction",
          },
        },
        {
          slot: "RB1",
          player: {
            name: "De'Von Achane",
            price: 50,
            source: "keeper",
          },
        },
      ],
    },
    {
      teamId: "team_seth",
      teamName: "Seth's Team",
      ownerName: "Seth",
      draftOrderPosition: 1,
      slots: [
        {
          slot: "QB",
          player: {
            name: "Jayden Daniels",
            price: 25,
            source: "auction",
          },
        },
        {
          slot: "BENCH2",
          player: {
            name: "Rashee Rice",
            price: 15,
            source: "keeper",
          },
        },
      ],
    },
  ],
} as const;

describe("draft export generator", () => {
  it("builds one rectangular sheet with metadata, team headers, numeric prices, blanks, and slot order", () => {
    const exportResult = generateDraftExport(baseState);

    expect(exportResult.sheetName).toBe("Draft Results");
    expect(exportResult.table.every(row => row.length === 6)).toBe(true);
    expect(exportResult.table[0]).toEqual(["League", "League 214674", "", "", "", ""]);
    expect(exportResult.table[1]).toEqual(["Season", 2026, "", "", "", ""]);
    expect(exportResult.table[2]).toEqual(["Draft room id", "room_abc", "", "", "", ""]);
    expect(exportResult.table[3]).toEqual(["Exported at", "2026-08-09T14:30:00.000Z", "", "", "", ""]);
    expect(exportResult.table[4]).toEqual(["Status", "in_progress", "Revision", 7, "", ""]);
    expect(exportResult.table[5]).toEqual(["Seth's Team", "", "", "Cam's Team", "", ""]);
    expect(exportResult.table[6]).toEqual(["Seth", "", "", "Cam", "", ""]);
    expect(exportResult.table[7]).toEqual(["Slot", "Player", "Price", "Slot", "Player", "Price"]);

    const rosterRows = exportResult.table.slice(8);
    expect(rosterRows.map(row => row[0])).toEqual([...draftExportSlotOrder]);
    expect(rosterRows.find(row => row[0] === "QB")).toEqual([
      "QB",
      "Jayden Daniels",
      25,
      "QB",
      "",
      "",
    ]);
    expect(rosterRows.find(row => row[0] === "RB1")).toEqual([
      "RB1",
      "",
      "",
      "RB1",
      "De'Von Achane",
      50,
    ]);
    expect(rosterRows.find(row => row[0] === "RB2")).toEqual([
      "RB2",
      "",
      "",
      "RB2",
      "",
      "",
    ]);
    expect(rosterRows.find(row => row[0] === "WR1")).toEqual([
      "WR1",
      "",
      "",
      "WR1",
      "Puka Nacua",
      62,
    ]);
    expect(rosterRows.find(row => row[0] === "BENCH2")).toEqual([
      "BENCH2",
      "Rashee Rice",
      15,
      "BENCH2",
      "",
      "",
    ]);
    expect(typeof rosterRows.find(row => row[0] === "RB1")?.[5]).toBe("number");
  });

  it("escapes CSV values without changing numeric prices in the table", () => {
    const exportResult = generateDraftExport({
      ...baseState,
      leagueName: "League, Home",
      teams: [
        {
          teamId: "team_quote",
          teamName: "Team, One",
          ownerName: "Cam \"The Commish\"",
          slots: [
            {
              slot: "WR1",
              player: {
                name: "Amon-Ra \"Sun God\", St. Brown",
                price: 28,
              },
            },
          ],
        },
      ],
    });

    expect(exportResult.table.find(row => row[0] === "WR1")?.[2]).toBe(28);
    expect(exportResult.csv).toContain("\"League, Home\"");
    expect(exportResult.csv).toContain("\"Team, One\"");
    expect(exportResult.csv).toContain("\"Cam \"\"The Commish\"\"\"");
    expect(exportResult.csv).toContain("WR1,\"Amon-Ra \"\"Sun God\"\", St. Brown\",28");
  });

  it("neutralizes spreadsheet formulas in user-controlled CSV cells", () => {
    const exportResult = generateDraftExport({
      ...baseState,
      leagueName: "=HYPERLINK(\"https://example.test\")",
      teams: [
        {
          teamId: "team_formula",
          teamName: "  +SUM(1,1)",
          ownerName: "\t@IMPORTDATA(\"https://example.test\")",
          slots: [
            {
              slot: "WR1",
              player: {
                name: " -2+3",
                price: 28,
              },
            },
            {
              slot: "RB1",
              player: {
                name: "Normal Player",
                price: 19,
              },
            },
          ],
        },
      ],
    });

    expect(exportResult.csv).toContain("\"'=HYPERLINK(\"\"https://example.test\"\")\"");
    expect(exportResult.csv).toContain("\"'  +SUM(1,1)\"");
    expect(exportResult.csv).toContain("\"'\t@IMPORTDATA(\"\"https://example.test\"\")\"");
    expect(exportResult.csv).toContain("WR1,' -2+3,28");
    expect(exportResult.csv).toContain("RB1,Normal Player,19");
    expect(exportResult.table[0]?.[1]).toBe("=HYPERLINK(\"https://example.test\")");
    expect(exportResult.table.find(row => row[0] === "RB1")?.[2]).toBe(19);
  });

  it("rejects duplicate players across committed team slots", () => {
    expect(() =>
      generateDraftExport({
        ...baseState,
        teams: [
          {
            teamId: "team_cam",
            teamName: "Cam's Team",
            ownerName: "Cam",
            slots: [
              {
                slot: "WR1",
                player: {
                  name: "Puka Nacua",
                  price: 62,
                },
              },
            ],
          },
          {
            teamId: "team_seth",
            teamName: "Seth's Team",
            ownerName: "Seth",
            slots: [
              {
                slot: "WR2",
                player: {
                  name: "puka nacua",
                  price: 60,
                },
              },
            ],
          },
        ],
      }),
    ).toThrow(new DraftExportError(
      "duplicate_player",
      "Puka Nacua appears on both Cam's Team WR1 and Seth's Team WR2.",
    ));
  });

  it("rejects impossible negative prices", () => {
    expect(() =>
      generateDraftExport({
        ...baseState,
        teams: [
          {
            teamId: "team_cam",
            teamName: "Cam's Team",
            ownerName: "Cam",
            slots: [
              {
                slot: "RB1",
                player: {
                  name: "De'Von Achane",
                  price: -1,
                },
              },
            ],
          },
        ],
      }),
    ).toThrow(new DraftExportError(
      "invalid_price",
      "De'Von Achane on Cam's Team RB1 has an invalid price.",
    ));
  });

  it("sorts teams by draft order before name and always emits the canonical slot order", () => {
    const exportResult = generateDraftExport({
      ...baseState,
      teams: [
        {
          teamId: "team_z",
          teamName: "Z Team",
          ownerName: "Zach",
          draftOrderPosition: 3,
          slots: [{ slot: "BENCH7", player: { name: "Late Bench", price: 1 } }],
        },
        {
          teamId: "team_a",
          teamName: "A Team",
          ownerName: "Amy",
          draftOrderPosition: 3,
          slots: [{ slot: "K", player: { name: "Kicker", price: 1 } }],
        },
        {
          teamId: "team_first",
          teamName: "First Team",
          ownerName: "Frank",
          draftOrderPosition: 1,
          slots: [{ slot: "DST", player: { name: "Lions D/ST", price: 2 } }],
        },
      ],
    });

    expect(exportResult.table[5]).toEqual([
      "First Team",
      "",
      "",
      "A Team",
      "",
      "",
      "Z Team",
      "",
      "",
    ]);
    expect(exportResult.table.slice(8).map(row => row[0])).toEqual([...draftExportSlotOrder]);
  });
});
