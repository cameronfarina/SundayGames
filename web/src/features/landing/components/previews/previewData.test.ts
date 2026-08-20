import { describe, expect, it } from "vitest";
import { boardPreviewRows, targetPreviewRows } from "./previewData";

describe("preview data", () => {
  it("prices every plan target the same way the board prices it", () => {
    const bidsOnBoard = targetPreviewRows.flatMap(target => {
      const row = boardPreviewRows.find(candidate => candidate.name === target.name);
      return row === undefined ? [] : [[target.maximumBid, row.mine]];
    });

    expect(bidsOnBoard).toEqual([[64, 64], [61, 61]]);
  });

  it("stars exactly the players the plan carries a bid for", () => {
    const starred = boardPreviewRows.filter(row => row.targeted).map(row => row.name);

    expect(starred).toEqual(["Jahmyr Gibbs", "Puka Nacua"]);
  });
});
