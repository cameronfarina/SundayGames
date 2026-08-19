import { describe, expect, it } from "vitest";
import { titleForPath } from "./routeMetadata";

describe("route metadata", () => {
  it.each([
    ["/practice", "Draft lab | Sunday Games"],
    ["/league", "League | Sunday Games"],
    ["/my-team", "My team | Sunday Games"],
    ["/player-news", "Player news | Sunday Games"],
    ["/connections", "Connections | Sunday Games"],
    ["/commissioner", "Commissioner | Sunday Games"],
      ["/mock-drafts/session-1", "Mock draft | Sunday Games"],
      ["/draft-room", "Live draft | Sunday Games"],
      ["/leagues/sunday-games/draft", "Live draft | Sunday Games"],
      ["/leagues/sunday-games/practice", "Draft lab | Sunday Games"],
      ["/leagues/sunday-games/my-team", "My team | Sunday Games"],
      ["/leagues/sunday-games/player-news", "Player news | Sunday Games"],
      ["/leagues/sunday-games/commissioner", "Commissioner | Sunday Games"],
      ["/leagues/sunday-games", "League | Sunday Games"],
      ["/login", "Sign in | Sunday Games"],
    ["/signup", "Create account | Sunday Games"],
    ["/unknown", "Sunday Games"],
  ])("maps %s to a useful document title", (path, expectedTitle) => {
    expect(titleForPath(path)).toBe(expectedTitle);
  });
});
