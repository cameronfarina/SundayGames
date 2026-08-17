import { describe, expect, it } from "vitest";
import { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import { applyBlockers } from "./applyBlockers";

const blockedError = (body: unknown): PlatformApiError => new PlatformApiError({
  code: "league_setup_import_blocked",
  message: "Resolve league setup import blockers before applying.",
  status: 400,
  body,
});

describe("applyBlockers", () => {
  it("returns the row blockers from a blocked apply error", () => {
    expect(applyBlockers(blockedError({ import: { blockers: [
      { code: "blank_owner", message: "Owner is required.", rowNumber: 2 },
    ] } }))).toEqual([{ code: "blank_owner", message: "Owner is required.", rowNumber: 2 }]);
  });

  it("returns nothing for errors that are not blocked applies", () => {
    expect(applyBlockers(new Error("plain failure"))).toEqual([]);
    expect(applyBlockers(new PlatformApiError({
      code: "setup_failed", message: "Could not apply.", status: 422,
    }))).toEqual([]);
  });

  it("returns nothing when a blocked apply error has an unreadable body", () => {
    expect(applyBlockers(blockedError({ import: { blockers: "not-a-list" } }))).toEqual([]);
  });
});
