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
    expect(platformShellHtml).toContain("href=\"/draft-room\"");
    expect(platformShellHtml).toContain("Commissioner setup");
    expect(platformShellHtml).toContain("href=\"/setup\"");
    expect(platformShellHtml).toContain("id=\"setup-season-id-input\"");
    expect(platformShellHtml).toContain("id=\"setup-rows-input\"");
    expect(platformShellHtml).toContain("id=\"setup-preview-button\"");
    expect(platformShellHtml).toContain("id=\"setup-apply-button\"");
    expect(platformShellHtml).toContain("/setup-import/preview");
    expect(platformShellHtml).toContain("/setup-import/apply");
    expect(platformShellHtml).toContain("id=\"setup-blockers\"");
    expect(platformShellHtml).toContain("id=\"setup-pending-invites\"");
    expect(platformShellHtml).toContain("pending invites");
    expect(platformShellHtml).not.toContain("href=\"/mock-draft\"");
    expect(platformShellHtml).not.toContain("href=\"/prep\"");
    expect(platformShellHtml).not.toContain("Open mocks");
    expect(platformShellHtml).not.toContain("Open prep");
  });
});
