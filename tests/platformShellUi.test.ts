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
    expect(platformShellHtml).toContain("Need access? Ask your commissioner for an invitation.");
    expect(platformShellHtml).toContain("setHidden(authModeLink, !signupMode)");
    expect(platformShellHtml).toContain("invitationToken: signupInvitationToken()");
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
    expect(platformShellHtml).toContain("selectedLeague.membership?.ownerDisplayName");
    expect(platformShellHtml).toContain("query.set(\"owner\", ownerDisplayName)");
    expect(platformShellHtml).toContain("selectedLeague.liveDraft?.roomId");
    expect(platformShellHtml).toContain("draftRoomPathFor(selectedLeague.seasonId");
    expect(platformShellHtml).toContain("id=\"team-claim-panel\"");
    expect(platformShellHtml).toContain("id=\"team-claim-picker\"");
    expect(platformShellHtml).toContain("/team-claims");
    expect(platformShellHtml).toContain("ownerScopedPaths.has(item.path) && !selectedLeague.membership?.ownerDisplayName");
  });

  it("role-gates setup and renders actionable invitation controls", () => {
    expect(platformShellHtml).toContain("id=\"commissioner-nav-item\"");
    expect(platformShellHtml).toContain("selectedLeague.canManageLeague");
    expect(platformShellHtml).toContain("id=\"setup-workspace\"");
    expect(platformShellHtml).toContain("id=\"setup-season-id-input\"");
    expect(platformShellHtml).toContain("id=\"setup-rows-input\"");
    expect(platformShellHtml).toContain("id=\"setup-preview-button\"");
    expect(platformShellHtml).toContain("id=\"setup-apply-button\"");
    expect(platformShellHtml).toContain("id=\"setup-preview-table\"");
    expect(platformShellHtml).toContain("id=\"setup-team-table\"");
    expect(platformShellHtml).toContain("id=\"setup-team-body\"");
    expect(platformShellHtml).toContain("teams.length + \" teams configured.\"");
    expect(platformShellHtml).toContain('fetch("/seasons/" + encodeURIComponent(selectedLeague.seasonId)');
    expect(platformShellHtml).toContain("setupImport.records || []");
    expect(platformShellHtml).toContain("id=\"setup-invitations\"");
    expect(platformShellHtml).toContain("id=\"create-live-room-button\"");
    expect(platformShellHtml).toContain("id=\"open-setup-live-room\"");
    expect(platformShellHtml).toContain("state.setupLocked = hasRoom");
    expect(platformShellHtml).toContain("setupRowsInput.disabled = hasRoom");
    expect(platformShellHtml).toContain("Team assignments are locked after the live draft room is created.");
    expect(platformShellHtml).toContain('fetch("/seasons/" + encodeURIComponent(selectedLeague.seasonId) + "/live-room"');
    expect(platformShellHtml).toContain("window.location.assign(draftRoomPathFor(selectedLeague.seasonId, room.roomId))");
    expect(platformShellHtml).toContain("fetch(\"/invitations?seasonId=\"");
    expect(platformShellHtml).toContain("Copy invite link");
    expect(platformShellHtml).toContain("Reissue");
    expect(platformShellHtml).toContain("No pending invitations. Import owner emails to create invite links.");
    expect(platformShellHtml).toContain("fetch(actionPath, { method: \"POST\", credentials: \"same-origin\" }).then(readJson)");
    expect(platformShellHtml).toContain("fetch(\"/invitations/accept\"");
    expect(platformShellHtml).toContain("}).then(readJson)");
    expect(platformShellHtml).not.toContain("readJson(fetch(");
    expect(platformShellHtml).not.toContain("id=\"setup-pending-invites\"");
    expect(platformShellHtml).toContain('link.removeAttribute("href")');
    expect(platformShellHtml).not.toContain('["Decision support", "Strategy"');
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

  it("offers a compact accessible password change flow from the account header", () => {
    expect(platformShellHtml).toContain('id="account-settings-button"');
    expect(platformShellHtml).toContain('aria-haspopup="dialog"');
    expect(platformShellHtml).toContain('id="password-dialog"');
    expect(platformShellHtml).toContain('aria-labelledby="password-dialog-title"');
    expect(platformShellHtml).toContain('id="current-password-input"');
    expect(platformShellHtml).toContain('autocomplete="current-password"');
    expect(platformShellHtml).toContain('id="new-password-input"');
    expect(platformShellHtml).toContain('id="confirm-password-input"');
    expect(platformShellHtml).toContain('autocomplete="new-password"');
    expect(platformShellHtml).toContain('id="password-change-status"');
    expect(platformShellHtml).toContain('fetch("/session/password"');
    expect(platformShellHtml).toContain('method: "PUT"');
    expect(platformShellHtml).toContain('newPasswordConfirmation: confirmPasswordInput.value');
    expect(platformShellHtml).toContain('window.location.assign("/login?passwordChanged=1")');
    expect(platformShellHtml).toContain('id="auth-notice"');
  });
});
