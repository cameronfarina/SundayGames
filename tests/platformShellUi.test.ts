import { describe, expect, it } from "vitest";
import {
  draftRoomPathFor,
  platformShellHtml,
  platformShellNavigation,
} from "../src/platform/platformShellUi.js";

describe("platform shell UI", () => {
  it("uses route-backed product navigation and the canonical live draft URL", () => {
    expect(platformShellNavigation.map(item => [item.label, item.path])).toEqual([
      ["League", "/app"],
      ["Board", "/board"],
      ["Mock drafts", "/mock-drafts"],
      ["Simulations", "/simulations"],
      ["Strategy", "/strategy"],
      ["Live draft", "/draft-room"],
    ]);
    expect(draftRoomPathFor({ seasonId: "season 2026", roomId: "room/live" })).toBe(
      "/draft-room?seasonId=season+2026&roomId=room%2Flive",
    );
    expect(platformShellHtml).toContain("<nav class=\"product-nav\" aria-label=\"Primary\">");
    expect(platformShellHtml).toContain("aria-current");
    expect(platformShellHtml).not.toContain("localhost:4317");
    expect(platformShellHtml).not.toContain("draftBoardUrl.port");
  });

  it("renders distinct login and signup modes", () => {
    expect(platformShellHtml).toContain("window.location.pathname === \"/signup\"");
    expect(platformShellHtml).toContain("id=\"auth-title\"");
    expect(platformShellHtml).toContain("id=\"auth-submit-button\"");
    expect(platformShellHtml).toContain("id=\"auth-mode-link\"");
    expect(platformShellHtml).toContain("href=\"/signup\"");
    expect(platformShellHtml).toContain("href=\"/login\"");
    expect(platformShellHtml).toContain("minlength=\"8\"");
    expect(platformShellHtml).toContain("autocomplete=\"new-password\"");
    expect(platformShellHtml).not.toContain("id=\"create-account-button\"");
  });

  it("bootstraps durable league and team identity before enabling workspaces", () => {
    expect(platformShellHtml).toContain("fetch(\"/onboarding\"");
    expect(platformShellHtml).toContain("id=\"league-picker\"");
    expect(platformShellHtml).toContain("id=\"my-team-name\"");
    expect(platformShellHtml).toContain("id=\"membership-role\"");
    expect(platformShellHtml).toContain("selectedLeague.membership");
    expect(platformShellHtml).toContain("selectedLeague.liveDraft?.roomId");
    expect(platformShellHtml).toContain("draftRoomPathFor(selectedLeague.seasonId");
  });

  it("role-gates setup and renders actionable invitation controls", () => {
    expect(platformShellHtml).toContain("id=\"commissioner-nav-item\"");
    expect(platformShellHtml).toContain("selectedLeague.canManageLeague");
    expect(platformShellHtml).toContain("id=\"setup-workspace\"");
    expect(platformShellHtml).toContain("id=\"setup-season-id-input\"");
    expect(platformShellHtml).toContain("id=\"setup-rows-input\"");
    expect(platformShellHtml).toContain("id=\"setup-preview-button\"");
    expect(platformShellHtml).toContain("id=\"setup-apply-button\"");
    expect(platformShellHtml).toContain("id=\"setup-invitations\"");
    expect(platformShellHtml).toContain("fetch(\"/invitations?seasonId=\"");
    expect(platformShellHtml).toContain("Copy invite link");
    expect(platformShellHtml).toContain("Reissue");
    expect(platformShellHtml).not.toContain("id=\"setup-pending-invites\"");
  });

  it("announces loading and errors and keeps useful content first on mobile", () => {
    expect(platformShellHtml).toContain("id=\"app-status\" class=\"status\" role=\"status\" aria-live=\"polite\"");
    expect(platformShellHtml).toContain("id=\"app-error\" class=\"error hidden\" role=\"alert\"");
    expect(platformShellHtml).toContain("id=\"retry-onboarding-button\"");
    expect(platformShellHtml).toContain("@media (min-width: 860px)");
    expect(platformShellHtml).toContain("overflow-x: auto");
    expect(platformShellHtml).not.toContain("class=\"cards\"");
    expect(platformShellHtml).not.toContain("Draft command center");
  });
});
