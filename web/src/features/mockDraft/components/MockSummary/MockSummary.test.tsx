import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { auctionStateSchema } from "../../api/auctionStateSchemas.js";
import { auctionMockResponseFixture } from "../../test/auctionMockResponseFixture.js";
import { MockSummary } from "./MockSummary.js";

describe("MockSummary", () => {
  it("shows neutral budget facts when the human team is unavailable", () => {
    const base = auctionMockResponseFixture().state;
    const state = auctionStateSchema.parse({ ...base, teams: [] });
    render(<MockSummary state={state} />);
    expect(screen.getByText("0 / 0 rostered")).toBeInTheDocument();
    expect(screen.getAllByText("-")).toHaveLength(4);
  });
});
