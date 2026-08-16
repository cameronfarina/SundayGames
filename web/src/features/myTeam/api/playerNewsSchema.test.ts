import { describe, expect, it } from "vitest";
import { playerNewsFeedFixture } from "./playerNews.fixture";
import { playerNewsFeedSchema } from "./playerNewsSchema";

describe("playerNewsFeedSchema", () => {
  it("accepts the typed news feed and rejects an unknown source mode", () => {
    expect(playerNewsFeedSchema.parse(playerNewsFeedFixture).items).toHaveLength(2);
    expect(playerNewsFeedSchema.safeParse({ ...playerNewsFeedFixture, sourceMode: "rotoworld" }).success)
      .toBe(false);
  });
});
