import { describe, expect, it } from "vitest";
import { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import { importFailure } from "./importFailure";

describe("importFailure", () => {
  it("keeps every reason the server listed alongside its sentence", () => {
    const error = new PlatformApiError({
      body: {
        error: {
          code: "import_needs_review",
          message: "This league needs a look before it can be imported.",
          issues: ["ESPN roster slot HC is not supported.", "Could not read the draft type."],
        },
      },
      code: "import_needs_review",
      message: "This league needs a look before it can be imported.",
      status: 422,
    });

    expect(importFailure(error)).toEqual({
      issues: ["ESPN roster slot HC is not supported.", "Could not read the draft type."],
      message: "This league needs a look before it can be imported.",
    });
  });

  it("keeps the draft defaults needed to finish an import", () => {
    const error = new PlatformApiError({
      body: {
        error: {
          code: "import_needs_review",
          message: "Choose the draft format to finish importing this league.",
          issues: ["ESPN did not include this league's draft format."],
          draftSetup: {
            auctionBudgetDollars: 200,
            minimumBidDollars: 1,
            snakeRounds: 16,
          },
        },
      },
      code: "import_needs_review",
      message: "Choose the draft format to finish importing this league.",
      status: 422,
    });

    expect(importFailure(error)).toMatchObject({
      draftSetup: { auctionBudgetDollars: 200, minimumBidDollars: 1, snakeRounds: 16 },
    });
  });

  it("carries a plain refusal through with nothing invented", () => {
    const error = new PlatformApiError({
      body: { error: { code: "snapshot_required", message: "Sync this league before importing it." } },
      code: "snapshot_required",
      message: "Sync this league before importing it.",
      status: 409,
    });

    expect(importFailure(error)).toEqual({
      issues: [],
      message: "Sync this league before importing it.",
    });
  });

  it("falls back to the thrown message when the failure never reached the server", () => {
    expect(importFailure(new Error("Network is down."))).toEqual({
      issues: [],
      message: "Network is down.",
    });
  });

  it("says something a person can read when nothing was thrown at all", () => {
    expect(importFailure("boom")).toEqual({
      issues: [],
      message: "Could not import this league. Try again in a moment.",
    });
  });
});
