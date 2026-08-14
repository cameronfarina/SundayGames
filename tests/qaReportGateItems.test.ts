import { describe, expect, it } from "vitest";
import type { QaGateItemInput } from "../src/modeling/qaReport.js";
import { topGateItems } from "../src/modeling/qaReport/gateItems.js";

describe("QA report gate item selection", () => {
  it("shows at most five failures before warnings and excludes passing gates", () => {
    const items: QaGateItemInput[] = [
      { key: "warning-b", status: "warn" },
      { key: "failure-c", status: "fail" },
      { key: "passing", status: "pass" },
      { key: "failure-a", status: "fail" },
      { key: "warning-a", status: "warn" },
      { key: "failure-b", status: "fail" },
      { key: "warning-c", status: "warn" },
    ];

    expect(topGateItems(items).map(item => item.key)).toEqual([
      "failure-a",
      "failure-b",
      "failure-c",
      "warning-a",
      "warning-b",
    ]);
  });
});
