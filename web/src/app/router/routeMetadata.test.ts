import { describe, expect, it } from "vitest";
import { titleForPath } from "./routeMetadata";

describe("route metadata", () => {
  it.each([
    ["/practice", "Draft lab | Mockd"],
    ["/league", "League | Mockd"],
    ["/my-team", "My team | Mockd"],
    ["/player-news", "Player news | Mockd"],
    ["/commissioner", "Commissioner | Mockd"],
      ["/mock-drafts/session-1", "Mock draft | Mockd"],
      ["/draft-room", "Live draft | Mockd"],
      ["/leagues/sunday-games/draft", "Live draft | Mockd"],
      ["/leagues/sunday-games/practice", "Draft lab | Mockd"],
      ["/leagues/sunday-games/my-team", "My team | Mockd"],
      ["/leagues/sunday-games/player-news", "Player news | Mockd"],
      ["/leagues/sunday-games/commissioner", "Commissioner | Mockd"],
      ["/leagues/sunday-games", "League | Mockd"],
      ["/login", "Sign in | Mockd"],
    ["/signup", "Create account | Mockd"],
    ["/unknown", "Mockd"],
  ])("maps %s to a useful document title", (path, expectedTitle) => {
    expect(titleForPath(path)).toBe(expectedTitle);
  });
});
