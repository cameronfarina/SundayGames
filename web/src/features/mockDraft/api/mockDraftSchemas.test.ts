import { describe, expect, it } from "vitest";
import { auctionMockResponseFixture } from "../test/auctionMockResponseFixture.js";
import { auctionMockResponseSchema } from "./mockDraftSchemas.js";

describe("auctionMockResponseSchema manager profiles", () => {
  it("keeps older auction responses compatible by defaulting profiles to an empty list", () => {
    const response = auctionMockResponseSchema.parse(auctionMockResponseFixture());

    expect(response.managerProfiles).toEqual([]);
  });

  it("parses a manager profile derived from imported auction history", () => {
    const response = auctionMockResponseSchema.parse({
      ...auctionMockResponseFixture(),
      managerProfiles: [{
        confidence: "established",
        premiumVsLeagueBaselinePercent: 14,
        sample: {
          auctionPurchaseCount: 24,
          comparablePurchaseCount: 18,
          seasonCount: 3,
        },
        starBidding: "high",
        status: "ready",
        targetLabel: "WR focus",
        targetPosition: "WR",
        teamId: "team-owner01",
      }],
    });

    expect(response.managerProfiles).toEqual([expect.objectContaining({
      confidence: "established",
      status: "ready",
      targetPosition: "WR",
      teamId: "team-owner01",
    })]);
  });
});
