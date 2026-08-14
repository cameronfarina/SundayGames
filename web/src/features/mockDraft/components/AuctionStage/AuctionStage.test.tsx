import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { auctionEventSchema } from "../../api/auctionStateSchemas.js";
import { auctionMockResponseFixture } from "../../test/auctionMockResponseFixture.js";
import { AuctionStage } from "./AuctionStage.js";

describe("AuctionStage", () => {
  it("shows the live bid, max bid, activity, countdown, and decisions", async () => {
    const response = auctionMockResponseFixture();
    const nomination = response.state.session.currentNomination;
    const events = auctionEventSchema.array().parse([
      ...response.state.auctionEvents,
      {
        countdown: 5,
        nominationNumber: 1,
        playerId: "gibbs",
        playerName: "Jahmyr Gibbs",
        sequence: 3,
        text: "5",
        type: "countdown",
      },
    ]);
    const onBuy = vi.fn();
    const onPass = vi.fn();
    expect(nomination).toBeDefined();
    if (nomination === undefined) return;
    render(
      <AuctionStage
        busy={false}
        events={events}
        humanMaxBid={136}
        nomination={nomination}
        onBuy={onBuy}
        onPass={onPass}
      />,
    );

    expect(screen.getByRole("heading", { name: "Jahmyr Gibbs" })).toBeInTheDocument();
    expect(screen.getByText("Current bid $71")).toBeInTheDocument();
    expect(screen.getByText("Your max bid $136")).toBeInTheDocument();
    expect(screen.getByText("Dart Vader has the high bid")).toBeInTheDocument();
    expect(screen.getByText("5 seconds")).toBeInTheDocument();
    expect(screen.getByText("Dart Vader bid $71")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Bid $72" }));
    await userEvent.click(screen.getByRole("button", { name: "Pass" }));
    expect(onBuy).toHaveBeenCalledWith(72);
    expect(onPass).toHaveBeenCalledOnce();
  });

  it("prompts for the next nomination when no bidding is active", () => {
    render(
      <AuctionStage
        busy={false}
        events={[]}
        humanMaxBid={136}
        onBuy={vi.fn()}
        onPass={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: "Choose the next player" })).toBeInTheDocument();
    expect(screen.getByText("Bids and sales will appear here.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Bid/u })).not.toBeInTheDocument();
  });
});
