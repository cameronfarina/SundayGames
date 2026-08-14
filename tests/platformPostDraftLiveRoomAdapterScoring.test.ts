import { describe, expect, it } from "vitest";
import { postDraftScoringSettingsIdForSeason } from "../src/platform/postDraftLiveRoomAdapter.js";
import { season } from "./postDraftLiveRoomAdapter/seasonFixture.js";

describe("post-draft live room scoring identity", () => {
  it("is stable for non-scoring changes and changes when a scoring rule changes", () => {
    const original = season();
    const renamed = season();
    renamed.league.name = "Renamed League";
    const changedScoring = season();
    changedScoring.settings.scoring.reception = 1;

    const originalId = postDraftScoringSettingsIdForSeason(original);
    expect(postDraftScoringSettingsIdForSeason(renamed)).toBe(originalId);
    expect(postDraftScoringSettingsIdForSeason(changedScoring)).not.toBe(originalId);
    expect(originalId).toMatch(/^season_2026:scoring:[a-f0-9]{16}$/);
  });
});
