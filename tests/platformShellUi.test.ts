import { describe, expect, it } from "vitest";
import { platformShellHtml } from "../src/platform/platformShellUi.js";

describe("platform shell UI", () => {
  it("ships a cookie-backed auth shell and unified product frame", () => {
    expect(platformShellHtml).toContain("id=\"auth-panel\"");
    expect(platformShellHtml).toContain("id=\"app-shell\"");
    expect(platformShellHtml).toContain("GET /session");
    expect(platformShellHtml).toContain("fetch(\"/sessions\"");
    expect(platformShellHtml).toContain("fetch(\"/accounts\"");
    expect(platformShellHtml).toContain("fetch(\"/session\", { method: \"DELETE\" })");
    expect(platformShellHtml).toContain("Live draft room");
    expect(platformShellHtml).toContain("Mock drafts");
    expect(platformShellHtml).toContain("League prep");
  });
});
