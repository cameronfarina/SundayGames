import { describe, expect, it } from "vitest";
import { importRequest } from "./importRequest";

describe("importRequest", () => {
  it("builds a new league without needing anything else", () => {
    expect(importRequest("create", undefined)).toEqual({ mode: "create" });
  });

  it("names the season a replacement overwrites", () => {
    expect(importRequest("overwrite", "season-7"))
      .toEqual({ mode: "overwrite", seasonId: "season-7" });
  });

  it("refuses to guess which league a replacement means", () => {
    expect(importRequest("overwrite", undefined)).toBeUndefined();
  });
});
