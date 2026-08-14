import { Buffer } from "node:buffer";
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { parseHistoricalImportSource } from "../src/platform/historicalImportSource.js";
import { historicalSpreadsheetUploadToSourceText } from "../src/platform/historicalSpreadsheetImport.js";

const workbookArchive = (): string => Buffer.from(zipSync({
  "xl/workbook.xml": new TextEncoder().encode("workbook"),
})).toString("base64");

const expectedRows = [{
  sourceRowNumber: 2,
  seasonYear: 2025,
  ownerDisplayName: "Legacy Team",
  playerName: "New England Patriots",
  playerId: "player-patriots-dst",
  position: "DST",
  priceDollars: 3,
  publicPriceDollars: 2,
  keeper: true,
  acquisitionType: "keeper",
}];

describe("historical import source formats", () => {
  it("normalizes equivalent CSV, TSV, and XLSX rows to one import contract", async () => {
    const csv = [
      "team,name,pos,salary,espn aav,year,espn id,is keeper,type",
      "Legacy Team,New England Patriots,DEF,$3,$2,2025,player-patriots-dst,yes,keeper",
    ].join("\n");
    const tsv = [
      "team\tname\tpos\tsalary\tespn aav\tyear\tespn id\tis keeper\ttype",
      "Legacy Team\tNew England Patriots\tDEF\t$3\t$2\t2025\tplayer-patriots-dst\tyes\tkeeper",
    ].join("\n");
    const xlsx = await historicalSpreadsheetUploadToSourceText({
      fileName: "draft.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64: workbookArchive(),
    }, {
      readWorkbook: async () => [
        ["team", "name", "pos", "salary", "espn aav", "year", "espn id", "is keeper", "type"],
        ["Legacy Team", "New England Patriots", "DEF", "$3", "$2", 2025, "player-patriots-dst", "yes", "keeper"],
      ],
    });

    expect(parseHistoricalImportSource(csv).rows).toEqual(expectedRows);
    expect(parseHistoricalImportSource(tsv).rows).toEqual(expectedRows);
    expect(parseHistoricalImportSource(xlsx).rows).toEqual(expectedRows);
  });

  it("preserves actionable warnings while retaining rows for downstream review", () => {
    const result = parseHistoricalImportSource([
      "owner,team,player,position,price,year,aav,keeper,type",
      "Legacy Team,Ignored,Player One,RB,$4,next,$five,maybe,trade",
    ].join("\n"));

    expect(result.rows).toEqual([{
      sourceRowNumber: 2,
      ownerDisplayName: "Legacy Team",
      playerName: "Player One",
      position: "RB",
      priceDollars: 4,
    }]);
    expect(result.warnings).toEqual([
      {
        code: "duplicate_header",
        message: "Header \"team\" duplicates the owner field; the first matching column will be used.",
        rowNumber: 1,
        column: "owner",
      },
      {
        code: "invalid_season_year",
        message: "Row 2 has an invalid season year \"next\".",
        rowNumber: 2,
        column: "seasonYear",
      },
      {
        code: "invalid_public_price",
        message: "Row 2 has an invalid same-season public value \"$five\".",
        rowNumber: 2,
        column: "publicPrice",
      },
      {
        code: "invalid_keeper",
        message: "Row 2 has an unrecognized keeper value \"maybe\".",
        rowNumber: 2,
        column: "keeper",
      },
      {
        code: "invalid_acquisition_type",
        message: "Row 2 has an unrecognized acquisition type \"trade\".",
        rowNumber: 2,
        column: "acquisitionType",
      },
    ]);
  });
});
