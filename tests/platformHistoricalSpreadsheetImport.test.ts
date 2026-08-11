import { describe, expect, it, vi } from "vitest";
import { zipSync } from "fflate";

import {
  historicalSpreadsheetUploadToSourceText,
  HistoricalSpreadsheetUploadError,
} from "../src/platform/historicalSpreadsheetImport.js";

const base64For = (value: string): string => Buffer.from(value, "utf8").toString("base64");
const xlsxBase64For = (contents: Uint8Array = new TextEncoder().encode("workbook")): string =>
  Buffer.from(zipSync({ "xl/workbook.xml": contents })).toString("base64");

describe("historical spreadsheet uploads", () => {
  it("decodes UTF-8 CSV and TSV files without changing their rows", async () => {
    await expect(historicalSpreadsheetUploadToSourceText({
      fileName: "draft-2025.csv",
      mimeType: "text/csv",
      base64: base64For("owner,player,position,price\nCam,Achane,RB,50"),
    })).resolves.toBe("owner,player,position,price\nCam,Achane,RB,50");
    await expect(historicalSpreadsheetUploadToSourceText({
      fileName: "draft-2025.tsv",
      mimeType: "text/tab-separated-values",
      base64: base64For("owner\tplayer\tposition\tprice\nCam\tAchane\tRB\t50"),
    })).resolves.toContain("Cam\tAchane\tRB\t50");
  });

  it("converts the first XLSX worksheet into safe CSV source text", async () => {
    const readWorkbook = vi.fn(async () => [
      ["owner", "player", "position", "price"],
      ["Cam", "Achane, De'Von", "RB", 50],
    ]);

    await expect(historicalSpreadsheetUploadToSourceText({
      fileName: "draft-2025.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64: xlsxBase64For(),
    }, { readWorkbook })).resolves.toBe(
      'owner,player,position,price\nCam,"Achane, De\'Von",RB,50',
    );
    expect(readWorkbook).toHaveBeenCalledOnce();
  });

  it("rejects XLSX archives that expand beyond the safe workbook limit", async () => {
    const readWorkbook = vi.fn(async () => [["must not run"]]);
    const compressedWorkbook = xlsxBase64For(new Uint8Array(32_000));

    await expect(historicalSpreadsheetUploadToSourceText({
      fileName: "draft-2025.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64: compressedWorkbook,
    }, {
      maxUncompressedBytes: 1_000,
      readWorkbook,
    })).rejects.toThrow("expand to 1000 bytes or fewer");
    expect(readWorkbook).not.toHaveBeenCalled();
  });

  it("rejects unsupported, empty, oversized, and mislabeled files", async () => {
    await expect(historicalSpreadsheetUploadToSourceText({
      fileName: "draft.pdf",
      mimeType: "application/pdf",
      base64: base64For("not a draft"),
    })).rejects.toBeInstanceOf(HistoricalSpreadsheetUploadError);
    await expect(historicalSpreadsheetUploadToSourceText({
      fileName: "draft.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64: base64For("not zip"),
    })).rejects.toThrow("valid XLSX");
    await expect(historicalSpreadsheetUploadToSourceText({
      fileName: "draft.csv",
      mimeType: "text/csv",
      base64: base64For("too large"),
    }, { maxBytes: 2 })).rejects.toThrow("2 bytes or smaller");
  });
});
