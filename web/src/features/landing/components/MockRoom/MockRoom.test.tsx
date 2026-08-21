import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockRoom } from "./MockRoom";

describe("MockRoom", () => {
  it("shows the room and the rival whose habits shape it", () => {
    render(<MockRoom />);

    expect(screen.getByRole("heading", { level: 2 }))
      .toHaveTextContent("Your opponents aren’t random. Your mocks shouldn’t be.");
    expect(screen.getByRole("region", { name: "Live auction" })).toBeVisible();
    expect(screen.getByText("Red Zone Rebels")).toBeVisible();
  });

  it("reads one rival's habits off their own draft history", () => {
    render(<MockRoom />);

    expect(screen.getByText("Historical target")).toBeVisible();
    expect(screen.getByText("WR focus")).toBeVisible();
    expect(screen.getByText("Premium vs league baseline")).toBeVisible();
    expect(screen.getByText("+14%")).toBeVisible();
    expect(screen.getByText("Star bidding")).toBeVisible();
    expect(screen.getByText("Players to watch")).toBeVisible();
    expect(screen.getByText(/past auction drafts/u)).toBeVisible();
  });
});
