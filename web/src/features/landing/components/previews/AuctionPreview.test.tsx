import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuctionPreview } from "./AuctionPreview";

describe("AuctionPreview", () => {
  it("shows who holds the bid, what it costs to answer, and the viewer's ceiling", () => {
    render(<AuctionPreview />);

    expect(screen.getByRole("heading", { name: "Puka Nacua" })).toBeVisible();
    expect(screen.getByText("Current bid $54")).toBeVisible();
    expect(screen.getByText("Red Zone Rebels has the high bid")).toBeVisible();
    expect(screen.getByText("Your max bid $67")).toBeVisible();
    expect(screen.getByText("Bid $55")).toBeVisible();
  });

  it("lists the bids that led to the current price", () => {
    render(<AuctionPreview />);

    const activity = screen.getByRole("list", { name: "Auction activity" });

    expect(within(activity).getAllByRole("listitem")).toHaveLength(5);
  });
});
