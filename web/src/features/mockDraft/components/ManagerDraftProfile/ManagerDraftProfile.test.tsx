import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AuctionPlayer } from "../../api/auctionBoardSchemas.js";
import type { ManagerDraftProfile as Profile } from "../../api/mockDraftSchemas.js";
import { ManagerDraftProfile } from "./ManagerDraftProfile.js";

const readyProfile: Profile = {
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
};

const player = (
  id: string,
  name: string,
  position: string,
  expectedPrice: number,
  available = true,
): AuctionPlayer => ({
  available,
  expectedPrice,
  id,
  name,
  position,
  status: available ? "available" : "sold",
});

describe("ManagerDraftProfile", () => {
  it("explains one rival's measured auction habits and two available targets", () => {
    render(<ManagerDraftProfile
      players={[
        player("lamb", "CeeDee Lamb", "WR", 71),
        player("chase", "Ja'Marr Chase", "WR", 80),
        player("nacua", "Puka Nacua", "WR", 68),
        player("jefferson", "Justin Jefferson", "WR", 79, false),
        player("gibbs", "Jahmyr Gibbs", "RB", 76),
      ]}
      profile={readyProfile}
      teamName="Dart Vader"
    />);

    const card = screen.getByRole("complementary", { name: "Dart Vader draft tendencies" });
    expect(within(card).getByText("Historical target")).toBeVisible();
    expect(within(card).getByText("WR focus")).toBeVisible();
    expect(within(card).getByText("Premium vs league baseline")).toBeVisible();
    expect(within(card).getByText("+14%")).toBeVisible();
    expect(within(card).getByText("Star bidding")).toBeVisible();
    expect(within(card).getByText("High")).toBeVisible();
    expect(within(card).getByText("Players to watch")).toBeVisible();
    expect(within(card).getByText("Ja'Marr Chase, CeeDee Lamb")).toBeVisible();
    expect(card).not.toHaveTextContent("Justin Jefferson");
    expect(card).not.toHaveTextContent("Puka Nacua");
    expect(within(card).getByText("Established confidence · 3 imported drafts"))
      .toBeVisible();
  });

  it("is explicit when a rival does not have enough imported history", () => {
    render(<ManagerDraftProfile
      players={[]}
      profile={{
        ...readyProfile,
        confidence: null,
        premiumVsLeagueBaselinePercent: null,
        sample: {
          auctionPurchaseCount: 4,
          comparablePurchaseCount: 3,
          seasonCount: 1,
        },
        starBidding: null,
        status: "insufficient-history",
        targetLabel: null,
        targetPosition: null,
      }}
      teamName="Sentinels"
    />);

    const card = screen.getByRole("complementary", { name: "Sentinels draft tendencies" });
    expect(within(card).getByText("Not enough history yet")).toBeVisible();
    expect(within(card).getByText(/Import more past auction drafts/u)).toBeVisible();
    expect(within(card).getByText("1 imported draft")).toBeVisible();
    expect(within(card).queryByText("Star bidding")).not.toBeInTheDocument();
  });

  it("labels ready-profile gaps and non-positive premiums without inventing values", () => {
    const { rerender } = render(<ManagerDraftProfile
      players={[]}
      profile={{
        ...readyProfile,
        confidence: null,
        premiumVsLeagueBaselinePercent: null,
        sample: { ...readyProfile.sample, seasonCount: 1 },
        starBidding: null,
        targetLabel: null,
        targetPosition: null,
      }}
      teamName="Sentinels"
    />);

    expect(screen.getByText("No clear target")).toBeVisible();
    expect(screen.getByText("Not enough comparisons")).toBeVisible();
    expect(screen.getByText("Not enough history")).toBeVisible();
    expect(screen.getByText("No matching players left")).toBeVisible();
    expect(screen.getByText("Limited confidence · 1 imported draft")).toBeVisible();

    rerender(<ManagerDraftProfile
      players={[]}
      profile={{ ...readyProfile, premiumVsLeagueBaselinePercent: -7 }}
      teamName="Sentinels"
    />);
    expect(screen.getByText("-7%")).toBeVisible();
  });
});
