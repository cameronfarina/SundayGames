import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ManagerDraftProfile } from "../../api/mockDraftSchemas.js";
import { auctionMockResponseSchema } from "../../api/mockDraftSchemas.js";
import { auctionMockResponseFixture } from "../../test/auctionMockResponseFixture.js";
import { AuctionMockWorkspace } from "./AuctionMockWorkspace.js";

const profile = (teamId: string, targetLabel: string): ManagerDraftProfile => ({
  confidence: "established",
  premiumVsLeagueBaselinePercent: 14,
  sample: {
    auctionPurchaseCount: 24,
    comparablePurchaseCount: 18,
    seasonCount: 3,
  },
  starBidding: "high",
  status: "ready",
  targetLabel,
  targetPosition: "WR",
  teamId,
});

describe("AuctionMockWorkspace manager profile", () => {
  it("shows the AI high bidder's profile beside the auction stage", () => {
    const response = auctionMockResponseSchema.parse({
      ...auctionMockResponseFixture(),
      managerProfiles: [
        profile("team-owner01", "WR focus"),
        profile("team-owner04", "RB focus"),
      ],
    });

    render(<AuctionMockWorkspace busy={false} dispatch={vi.fn()} response={response} />);

    expect(screen.getByRole("complementary", { name: "Dart Vader draft tendencies" }))
      .toBeVisible();
    expect(screen.queryByRole("complementary", { name: "Sentinels draft tendencies" }))
      .not.toBeInTheDocument();
  });

  it("falls back to the AI nominator when the human is the high bidder", () => {
    const base = auctionMockResponseFixture();
    const nominator = {
      ...base.state.teams[1],
      id: "team-owner04",
      name: "Sentinels",
    };
    const response = auctionMockResponseSchema.parse({
      ...base,
      managerProfiles: [profile("team-owner04", "RB focus")],
      state: {
        ...base.state,
        session: {
          ...base.state.session,
          currentNomination: {
            ...base.state.session.currentNomination,
            highestBidderTeamId: base.state.session.humanTeamId,
            highestBidderTeamName: "Short King",
          },
        },
        teams: [...base.state.teams, nominator],
      },
    });

    render(<AuctionMockWorkspace busy={false} dispatch={vi.fn()} response={response} />);

    expect(screen.getByRole("complementary", { name: "Sentinels draft tendencies" }))
      .toBeVisible();
  });

  it("keeps older responses usable without an empty profile card", () => {
    render(<AuctionMockWorkspace
      busy={false}
      dispatch={vi.fn()}
      response={auctionMockResponseFixture()}
    />);

    expect(screen.queryByRole("heading", { name: "Draft tendencies" }))
      .not.toBeInTheDocument();
  });

  it("uses nomination names when a selected profile team is absent from the team list", () => {
    const base = auctionMockResponseFixture();
    const nomination = base.state.session.currentNomination;
    if (nomination === undefined) throw new Error("Expected an active nomination.");
    const missingNominatorId = "missing-nominator";
    const { rerender } = render(<AuctionMockWorkspace
      busy={false}
      dispatch={vi.fn()}
      response={auctionMockResponseSchema.parse({
        ...base,
        managerProfiles: [profile(missingNominatorId, "RB focus")],
        state: { ...base.state, session: { ...base.state.session, currentNomination: {
          ...nomination,
          highestBidderTeamId: base.state.session.humanTeamId,
          nominatedByTeamId: missingNominatorId,
          nominatedByTeamName: "Missing Nominator",
        } } },
      })}
    />);
    expect(screen.getByRole("complementary", { name: "Missing Nominator draft tendencies" }))
      .toBeVisible();

    const missingBidderId = "missing-bidder";
    rerender(<AuctionMockWorkspace
      busy={false}
      dispatch={vi.fn()}
      response={auctionMockResponseSchema.parse({
        ...base,
        managerProfiles: [profile(missingBidderId, "WR focus")],
        state: { ...base.state, session: { ...base.state.session, currentNomination: {
          ...nomination,
          highestBidderTeamId: missingBidderId,
          highestBidderTeamName: "Missing Bidder",
        } } },
      })}
    />);
    expect(screen.getByRole("complementary", { name: "Missing Bidder draft tendencies" }))
      .toBeVisible();

    rerender(<AuctionMockWorkspace
      busy={false}
      dispatch={vi.fn()}
      response={auctionMockResponseSchema.parse({
        ...base,
        managerProfiles: [profile(base.state.session.humanTeamId, "WR focus")],
        state: { ...base.state, session: { ...base.state.session, currentNomination: {
          ...nomination,
          highestBidderTeamId: base.state.session.humanTeamId,
          nominatedByTeamId: base.state.session.humanTeamId,
        } } },
      })}
    />);
    expect(screen.queryByRole("heading", { name: "Draft tendencies" }))
      .not.toBeInTheDocument();
  });
});
