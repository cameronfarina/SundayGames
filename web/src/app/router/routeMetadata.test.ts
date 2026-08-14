import { describe, expect, it } from "vitest";
import { titleForPath } from "./routeMetadata";

describe("route metadata", () => {
  it.each([
    ["/practice", "Draft lab | Mockd"],
    ["/league", "League | Mockd"],
    ["/my-team", "My team | Mockd"],
    ["/commissioner", "Commissioner | Mockd"],
    ["/mock-drafts/session-1", "Mock draft | Mockd"],
    ["/login", "Sign in | Mockd"],
    ["/signup", "Create account | Mockd"],
    ["/unknown", "Mockd"],
  ])("maps %s to a useful document title", (path, expectedTitle) => {
    expect(titleForPath(path)).toBe(expectedTitle);
  });
});
