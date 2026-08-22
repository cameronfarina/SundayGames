import { describe, expect, it } from "vitest";
import { isAllowedSundayGamesUrl } from "./serviceWorkerPolicy.js";

describe("isAllowedSundayGamesUrl", () => {
  it.each([
    "https://sundaygames.io/connections",
    "http://localhost:4319/connections",
    "http://127.0.0.1:4319/connections",
  ])("accepts an explicit Sunday Games environment: %s", url => {
    expect(isAllowedSundayGamesUrl(url)).toBe(true);
  });

  it.each([
    "https://attacker.example/",
    "https://sundaygames.io.attacker.example/",
    "https://preview.sundaygames.io/",
    "file:///tmp/sundaygames.html",
  ])("rejects an unapproved sender: %s", url => {
    expect(isAllowedSundayGamesUrl(url)).toBe(false);
  });
});
