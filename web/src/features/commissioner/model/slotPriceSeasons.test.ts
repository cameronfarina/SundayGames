import { describe, expect, it } from "vitest";
import { slotPriceSeasonSheets } from "./slotPriceSeasons";

describe("slotPriceSeasonSheets", () => {
  it("keeps a single-season paste whole under the year the commissioner chose", () => {
    const sheets = slotPriceSeasonSheets(["Slot,Price", "RB1,75", "RB2,72"].join("\n"), 2025);

    expect(sheets).toEqual([
      { seasonYear: 2025, sourceText: "Slot,Price\nRB1,75\nRB2,72" },
    ]);
  });

  it("splits a column of prices per draft year into a sheet each", () => {
    const sheets = slotPriceSeasonSheets([
      "Slot,2024,2023",
      "RB1,75,68",
      "RB2,72,64",
    ].join("\n"), 2025);

    expect(sheets).toEqual([
      { seasonYear: 2024, sourceText: "Slot,Price,Season\nRB1,75,2024\nRB2,72,2024" },
      { seasonYear: 2023, sourceText: "Slot,Price,Season\nRB1,68,2023\nRB2,64,2023" },
    ]);
  });

  it("carries a position and a rank column through a year split", () => {
    const sheets = slotPriceSeasonSheets([
      "Position,Rank,2024",
      "RB,1,75",
    ].join("\n"), 2025);

    expect(sheets).toEqual([
      { seasonYear: 2024, sourceText: "Position,Rank,Price,Season\nRB,1,75,2024" },
    ]);
  });

  it("leaves a slot with no price that year out of that year's sheet", () => {
    const sheets = slotPriceSeasonSheets([
      "Slot,2024,2023",
      "RB1,75,68",
      "RB2,,64",
    ].join("\n"), 2025);

    expect(sheets[0]?.sourceText).toBe("Slot,Price,Season\nRB1,75,2024");
    expect(sheets[1]?.sourceText).toBe("Slot,Price,Season\nRB1,68,2023\nRB2,64,2023");
  });

  it("drops a year column that priced nothing at all", () => {
    const sheets = slotPriceSeasonSheets(["Slot,2024,2023", "RB1,75,"].join("\n"), 2025);

    expect(sheets.map(entry => entry.seasonYear)).toEqual([2024]);
  });

  it("groups rows by a season column, newest year first", () => {
    const sheets = slotPriceSeasonSheets([
      "Slot,Price,Season",
      "RB1,68,2023",
      "RB1,75,2024",
      "RB2,72,2024",
    ].join("\n"), 2025);

    expect(sheets).toEqual([
      { seasonYear: 2024, sourceText: "Slot,Price,Season\nRB1,75,2024\nRB2,72,2024" },
      { seasonYear: 2023, sourceText: "Slot,Price,Season\nRB1,68,2023" },
    ]);
  });

  it("keeps the paste whole when a season column holds nothing readable", () => {
    const sheets = slotPriceSeasonSheets([
      "Slot,Price,Season",
      "RB1,75,last year",
    ].join("\n"), 2025);

    expect(sheets).toEqual([
      { seasonYear: 2025, sourceText: "Slot,Price,Season\nRB1,75,last year" },
    ]);
  });

  it("ignores a four digit number that is not a plausible draft year", () => {
    const sheets = slotPriceSeasonSheets(["Slot,1999", "RB1,75"].join("\n"), 2025);

    expect(sheets).toEqual([
      { seasonYear: 2025, sourceText: "Slot,1999\nRB1,75" },
    ]);
  });

  it("splits tab separated year columns without changing the delimiter", () => {
    const sheets = slotPriceSeasonSheets(["Slot\t2024", "RB1\t75"].join("\n"), 2025);

    expect(sheets).toEqual([
      { seasonYear: 2024, sourceText: "Slot\tPrice\tSeason\nRB1\t75\t2024" },
    ]);
  });

  it("splits semicolon separated sheets too", () => {
    const sheets = slotPriceSeasonSheets(["Slot;Price;Year", "RB1;75;2024"].join("\n"), 2025);

    expect(sheets).toEqual([
      { seasonYear: 2024, sourceText: "Slot;Price;Year\nRB1;75;2024" },
    ]);
  });

  it("hands a quoted paste to the server whole rather than splitting it apart", () => {
    const sourceText = ['Slot,Price,Season', '"RB1","75","2024"'].join("\n");
    const sheets = slotPriceSeasonSheets(sourceText, 2025);

    expect(sheets).toEqual([{ seasonYear: 2025, sourceText }]);
  });

  it("ignores blank lines between rows", () => {
    const sheets = slotPriceSeasonSheets("Slot,Price\n\nRB1,75\n\n", 2025);

    expect(sheets).toEqual([{ seasonYear: 2025, sourceText: "Slot,Price\nRB1,75" }]);
  });

  it("keeps a header with no rows under it whole", () => {
    const sheets = slotPriceSeasonSheets("Slot,Price", 2025);

    expect(sheets).toEqual([{ seasonYear: 2025, sourceText: "Slot,Price" }]);
  });

  it("treats a single column paste as one comma separated sheet", () => {
    const sheets = slotPriceSeasonSheets("Slot\nRB1", 2025);

    expect(sheets).toEqual([{ seasonYear: 2025, sourceText: "Slot\nRB1" }]);
  });

  it("treats a row that stops short of the year columns as unpriced", () => {
    const sheets = slotPriceSeasonSheets([
      "Slot,Extra,2024",
      "RB1,note,75",
      "RB2",
    ].join("\n"), 2025);

    expect(sheets).toEqual([
      { seasonYear: 2024, sourceText: "Slot,Extra,Price,Season\nRB1,note,75,2024" },
    ]);
  });

  it("blanks a trailing label column a row left off", () => {
    const sheets = slotPriceSeasonSheets([
      "Slot,2024,Note",
      "RB1,75,steal",
      "RB2,72",
    ].join("\n"), 2025);

    expect(sheets[0]?.sourceText)
      .toBe("Slot,Note,Price,Season\nRB1,steal,75,2024\nRB2,,72,2024");
  });

  it("leaves out a row that never reaches the season column", () => {
    const sheets = slotPriceSeasonSheets([
      "Slot,Price,Season",
      "RB1,75,2024",
      "RB2,72",
    ].join("\n"), 2025);

    expect(sheets).toEqual([
      { seasonYear: 2024, sourceText: "Slot,Price,Season\nRB1,75,2024" },
    ]);
  });

  it("has nothing to import from an empty paste", () => {
    expect(slotPriceSeasonSheets("   \n  ", 2025)).toEqual([]);
  });
});
