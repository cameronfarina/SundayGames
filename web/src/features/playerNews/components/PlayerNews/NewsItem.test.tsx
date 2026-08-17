import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { playerNewsFeedFixture } from "../../api/playerNews.fixture";
import { NewsItem } from "./NewsItem";

describe("NewsItem", () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it("shows player context, a concise timestamp, and the original source", async () => {
    vi.stubEnv("TZ", "America/New_York");
    const item = playerNewsFeedFixture.items[0];
    if (item === undefined) throw new Error("Expected a news fixture.");
    const onToggleFollow = vi.fn();
    render(<NewsItem followed={false} item={item} onToggleFollow={onToggleFollow} />);
    expect(screen.getByText("Ladd McConkey · WR · LAC")).toBeVisible();
    expect(screen.queryByText("Move up")).not.toBeInTheDocument();
    expect(screen.getByText(/\$18 live \/ \$22 max/u)).toBeVisible();
    expect(screen.getByText(/8\/16\/2026, 9:30am/u)).toBeVisible();
    expect(screen.getByRole("link", { name: "Open source" })).toHaveAttribute("href", "https://example.com/ladd");
    await userEvent.click(screen.getByRole("button", { name: "Add Ladd McConkey to my players" }));
    expect(onToggleFollow).toHaveBeenCalledWith("Ladd McConkey");
  });

  it("handles provider evidence without player metadata, links, or valid dates", () => {
    const item = playerNewsFeedFixture.items[1];
    if (item === undefined) throw new Error("Expected a news fixture.");
    render(<NewsItem followed item={{ ...item, fetchedAt: "not-a-date", player: "NFL", position: undefined }} onToggleFollow={vi.fn()} />);
    expect(screen.getByText("NFL")).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove NFL from my players" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Mockd evidence")).toBeVisible();
  });

  it("shows a position when the NFL team is unavailable", () => {
    const item = playerNewsFeedFixture.items[0];
    if (item === undefined) throw new Error("Expected a news fixture.");
    render(<NewsItem followed={false} item={{ ...item, teamAbbreviation: undefined }} onToggleFollow={vi.fn()} />);
    expect(screen.getByText("Ladd McConkey · WR")).toBeVisible();
  });
});
