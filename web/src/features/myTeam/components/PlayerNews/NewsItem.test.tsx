import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { playerNewsFeedFixture } from "../../api/playerNews.fixture";
import { NewsItem } from "./NewsItem";

describe("NewsItem", () => {
  it("shows player context, impact, availability, and the original source", () => {
    const item = playerNewsFeedFixture.items[0];
    if (item === undefined) throw new Error("Expected a news fixture.");
    render(<NewsItem item={item} />);
    expect(screen.getByText("Ladd McConkey · WR · LAC")).toBeVisible();
    expect(screen.getByText("Move up")).toBeVisible();
    expect(screen.getByText(/\$18 live \/ \$22 max/u)).toBeVisible();
    expect(screen.getByRole("link", { name: "Open source" })).toHaveAttribute("href", "https://example.com/ladd");
  });

  it("handles provider evidence without player metadata, links, or valid dates", () => {
    const item = playerNewsFeedFixture.items[1];
    if (item === undefined) throw new Error("Expected a news fixture.");
    render(<NewsItem item={{ ...item, fetchedAt: "not-a-date", player: "NFL", position: undefined }} />);
    expect(screen.getByText("NFL")).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Mockd evidence")).toBeVisible();
  });

  it("shows a position when the NFL team is unavailable", () => {
    const item = playerNewsFeedFixture.items[0];
    if (item === undefined) throw new Error("Expected a news fixture.");
    render(<NewsItem item={{ ...item, teamAbbreviation: undefined }} />);
    expect(screen.getByText("Ladd McConkey · WR")).toBeVisible();
  });
});
