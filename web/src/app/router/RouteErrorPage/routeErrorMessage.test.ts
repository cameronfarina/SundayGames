import { describe, expect, it } from "vitest";
import { routeErrorMessage } from "./routeErrorMessage";

describe("route error message", () => {
  it("uses helpful copy for missing pages", () => {
    const missingRoute = { status: 404, statusText: "Not Found", internal: true, data: null };
    expect(routeErrorMessage(missingRoute)).toBe("We couldn't find that page.");
  });

  it("explains a failed page-file load after a deploy", () => {
    const staleChunk = new TypeError(
      "Failed to fetch dynamically imported module: https://sundaygames.io/assets/playerNewsRoute-btdGVP8y.js",
    );
    expect(routeErrorMessage(staleChunk))
      .toBe("We updated the site while this tab was open. Refresh the page to continue.");
  });

  it("preserves application error messages", () => {
    expect(routeErrorMessage(new Error("League failed to load."))).toBe("League failed to load.");
  });

  it("uses safe copy for unexpected failures", () => {
    expect(routeErrorMessage("broken")).toBe("Something went wrong on our end.");
  });
});
