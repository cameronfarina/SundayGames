import { describe, expect, it } from "vitest";
import {
  draftRoomPathFor,
  platformShellHtml,
  platformShellNavigation,
  rosterSlotDisplayOrder,
} from "../src/platform/platformShellUi.js";

describe("platform shell UI", () => {
  it("renders roster slots in fantasy lineup order", () => {
    expect(rosterSlotDisplayOrder).toEqual([
      "QB",
      "RB",
      "WR",
      "TE",
      "FLEX",
      "DST",
      "K",
      "BENCH",
    ]);
    expect(platformShellHtml).toContain(
      'const leagueRosterSlotOrder = ["QB","RB","WR","TE","FLEX","DST","K","BENCH"];',
    );
    expect(platformShellHtml).toContain("rosterSlotRank(left) - rosterSlotRank(right)");
  });

  it("uses route-backed product navigation and the canonical live draft URL", () => {
    expect(platformShellNavigation.map(item => [item.label, item.path])).toEqual([
      ["Board", "/board"],
      ["League", "/league"],
      ["My team", "/my-team"],
    ]);
    expect(draftRoomPathFor({ seasonId: "season 2026", roomId: "room/live" })).toBe(
      "/draft-room?seasonId=season+2026&roomId=room%2Flive",
    );
    expect(platformShellHtml).toContain("<nav class=\"product-nav\" aria-label=\"Primary\">");
    expect(platformShellHtml).toContain("aria-current");
    expect(platformShellHtml).not.toContain("localhost:4317");
    expect(platformShellHtml).not.toContain("draftBoardUrl.port");
  });

  it("renders login, signup, verification, and password recovery modes", () => {
    expect(platformShellHtml).toContain("window.location.pathname === \"/signup\"");
    expect(platformShellHtml).toContain("id=\"auth-title\"");
    expect(platformShellHtml).toContain("id=\"auth-submit-button\"");
    expect(platformShellHtml).toContain("id=\"auth-mode-link\"");
    expect(platformShellHtml).toContain("New to Mockd?");
    expect(platformShellHtml).toContain('window.location.pathname === "/verify-email"');
    expect(platformShellHtml).toContain('window.location.pathname === "/forgot-password"');
    expect(platformShellHtml).toContain('window.location.pathname === "/reset-password"');
    expect(platformShellHtml).toContain('fetch("/email-verifications/consume"');
    expect(platformShellHtml).toContain('fetch("/password-resets/consume"');
    expect(platformShellHtml).toContain("Resend verification");
    expect(platformShellHtml).toContain(': "/board";');
    expect(platformShellHtml).toContain("setHidden(authModePrompt, false)");
    expect(platformShellHtml).toContain("invitationToken: signupInvitationToken()");
    expect(platformShellHtml).toContain("returnTo: authenticationReturnPath()");
    expect(platformShellHtml).toContain('"&returnTo=" + encodeURIComponent(authenticationReturnPath())');
    expect(platformShellHtml).toContain("minlength=\"8\"");
    expect(platformShellHtml).toContain("autocomplete=\"new-password\"");
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
    expect(platformShellHtml).toContain("body.claimableTeams || []");
    expect(platformShellHtml).toContain("ownerScopedPaths.has(item.path) && !selectedLeague.membership?.ownerDisplayName");
    expect(platformShellHtml).toContain('id="league-overview-settings"');
    expect(platformShellHtml).toContain('id="league-overview-team-body"');
    expect(platformShellHtml).toContain("renderLeagueOverview(body.season)");
    expect(platformShellHtml).toContain("isCurrentWorkspaceRequest(overviewSeasonId, overviewRequestGeneration)");
    expect(platformShellHtml).toContain("updateNavigationForNoLeague()");
    expect(platformShellHtml).toContain('item.path === "/my-team"');
  });

  it("keeps the full player board useful before a user creates or joins a league", () => {
    expect(platformShellHtml).toContain('id="standalone-board"');
    expect(platformShellHtml).toContain('id="standalone-player-search" type="search"');
    expect(platformShellHtml).toContain('id="standalone-position-filter"');
    expect(platformShellHtml).toContain('id="standalone-board-sort"');
    expect(platformShellHtml).toContain('<option value="our">Our value</option>');
    expect(platformShellHtml).toContain('id="standalone-pricing-source"');
    expect(platformShellHtml).toContain('id="standalone-pricing-warnings"');
    expect(platformShellHtml).toContain('body.personalized === true ? "our" : "market"');
    expect(platformShellHtml).toContain('displayRank: index + 1');
    expect(platformShellHtml).toContain('player.pricingWarnings.filter');
    expect(platformShellHtml).toContain('id="standalone-player-rows"');
    expect(platformShellHtml).toContain('id="standalone-player-scroll" class="table-scroll player-board-scroll"');
    expect(platformShellHtml).toContain('const endpoint = seasonId');
    expect(platformShellHtml).toContain('"/player-catalog?seasonId="');
    expect(platformShellHtml).toContain('routePath === "/board"');
    expect(platformShellHtml).toContain("playerCatalog.slice().sort");
    expect(platformShellHtml).toContain("sortedPlayers.filter");
    expect(platformShellHtml).toContain("Create a league");
    expect(platformShellHtml).toContain('id="league-info-button"');
    expect(platformShellHtml).toContain('id="league-setup-dialog"');
    expect(platformShellHtml).toContain('aria-labelledby="league-setup-title"');
    expect(platformShellHtml).toContain('data-league-step="basics"');
    expect(platformShellHtml).toContain('data-league-step="scoring"');
    expect(platformShellHtml).toContain('data-league-step="roster"');
    expect(platformShellHtml).toContain('data-league-step="teams"');
    expect(platformShellHtml).toContain('const leagueCreationSteps = ["basics", "scoring", "roster", "teams"]');
    expect(platformShellHtml).toContain('id="league-create-espn-id"');
    expect(platformShellHtml).toContain('id="league-create-team-count"');
    expect(platformShellHtml).toContain('id="league-create-auction-minimum-bid"');
    expect(platformShellHtml).toContain('id="league-create-roster-slots"');
    expect(platformShellHtml).toContain('id="league-create-warnings"');
    expect(platformShellHtml).toContain('id="league-create-back"');
    expect(platformShellHtml).toContain('id="league-create-next"');
    expect(platformShellHtml).toContain('id="league-create-submit"');
    expect(platformShellHtml).toContain("teamNamesComplete");
    expect(platformShellHtml).toContain("teams.length === expectedTeamCount");
    expect(platformShellHtml).not.toContain('data-field="rowConfirmed"');
    expect(platformShellHtml).not.toContain('id="league-create-confirmed"');
    expect(platformShellHtml).toContain('Snake (prep beta)');
    expect(platformShellHtml).toContain('Hosted live drafting is currently auction-only.');
    expect(platformShellHtml).toContain('fetch("/league-imports/espn/review"');
    expect(platformShellHtml).toContain("No settings were imported.");
    expect(platformShellHtml).toContain("renderLeagueCreationImportSummary");
    expect(platformShellHtml).not.toContain('data-league-step="references"');
    expect(platformShellHtml).not.toContain('id="league-create-members-file"');
    expect(platformShellHtml).not.toContain('id="league-create-reference-previews"');
    expect(platformShellHtml).not.toContain("Screenshots stay in this browser");
    expect(platformShellHtml).not.toContain("Screenshots are ready as local references.");
    expect(platformShellHtml).not.toContain("leagueCreationReferences");
    expect(platformShellHtml).not.toContain("renderLeagueCreationReferences");
    expect(platformShellHtml).toContain('fetch("/leagues"');
    const screenshotDisclosure =
      "Your entire selected image is sent to OpenAI for analysis. Before uploading, crop it to only the team and manager rows and remove invite links and email addresses. Mockd retains only the team number, abbreviation, team name, and manager names you approve.";
    expect(platformShellHtml.split(screenshotDisclosure)).toHaveLength(2);
    expect(platformShellHtml).toContain('id="historical-import-file"');
    expect(platformShellHtml).toContain('"Choose current team"');
    expect(platformShellHtml).toContain("state.historicalOwnerMappings[issue.sourceValue]");
    expect(platformShellHtml).toContain("sourceOwnerOrTeamLabel: entry[0]");
    expect(platformShellHtml).toContain('id="historical-import-preview-body"');
    expect(platformShellHtml).toContain('"Choose player"');
    expect(platformShellHtml).toContain("state.historicalPlayerMappings[issue.rowNumber]");
    expect(platformShellHtml).toContain("playerId: entry[1]");
    expect(platformShellHtml).toContain('id="keeper-command-input"');
    expect(platformShellHtml).toContain("Public value, ESPN value, or AAV column");
    expect(platformShellHtml).toContain("History was saved, but values were not recalibrated");
    expect(platformShellHtml).toContain("League values were recalibrated");
    expect(platformShellHtml).toContain('id="simulation-panel"');
    expect(platformShellHtml).toContain('id="standalone-board-open-simulations"');
    expect(platformShellHtml).toContain("simulationPanel.open = true");
    expect(platformShellHtml).toContain('id="simulation-count"');
    expect(platformShellHtml).toContain('id="simulation-strategy"');
    expect(platformShellHtml).toContain('fetch("/season-simulations"');
    expect(platformShellHtml).toContain('id="simulation-target-rate"');
    expect(platformShellHtml).toContain('id="simulation-exposure-body"');
    expect(platformShellHtml).toContain('id="my-team-claim-link"');
    expect(platformShellHtml).toContain('myTeamClaimLink.href = pathWithSeason("/league"');
    expect(platformShellHtml).not.toContain("Accept an invitation from your commissioner to join your league.");
    expect(platformShellHtml).toContain("Create a league as commissioner, or join one from an invitation.");
    expect(platformShellHtml).not.toContain("Use the email address where your league invitation was sent.");
  });

  it("runs claimed teams through one league-aware mock draft workspace", () => {
    expect(platformShellHtml).toContain('id="mock-draft-workspace"');
    expect(platformShellHtml).toContain('id="mock-draft-player-rows"');
    expect(platformShellHtml).toContain('id="mock-draft-roster"');
    expect(platformShellHtml).toContain('id="mock-draft-player-scroll" class="table-scroll player-board-scroll"');
    expect(platformShellHtml).toContain('class="workspace-section mock-roster-panel"');
    expect(platformShellHtml).toContain('id="mock-draft-buy"');
    expect(platformShellHtml).toContain('id="mock-draft-pass"');
    expect(platformShellHtml).toContain('fetch("/season-mock-drafts"');
    expect(platformShellHtml).toContain('"/season-mock-drafts/" + encodeURIComponent');
    expect(platformShellHtml).toContain('type: "start"');
    expect(platformShellHtml).toContain('type: "pick"');
    expect(platformShellHtml).toContain('type: "nominate"');
    expect(platformShellHtml).toContain('type: "buy"');
    expect(platformShellHtml).toContain('type: "pass"');
    expect(platformShellHtml).toContain('type: "undo"');
    expect(platformShellHtml).toContain('routePath === "/mock-drafts"');
    expect(platformShellHtml).not.toContain('featureRoutes[routePath]');
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
    expect(platformShellHtml).toContain("id=\"setup-settings-summary\"");
    expect(platformShellHtml).toContain("id=\"screenshot-import-file\"");
    expect(platformShellHtml).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(platformShellHtml).toContain("id=\"screenshot-analyze-button\"");
    expect(platformShellHtml).toContain("Your entire selected image is sent to OpenAI for analysis.");
    expect(platformShellHtml).toContain("remove invite links and email addresses");
    expect(platformShellHtml).toContain("Mockd retains only the team number, abbreviation, team name, and manager names you approve.");
    expect(platformShellHtml).toContain("id=\"screenshot-review-table\"");
    expect(platformShellHtml).toContain("id=\"screenshot-apply-button\"");
    expect(platformShellHtml).toContain('setupEndpoint("screenshot-analyze")');
    expect(platformShellHtml).toContain('setupEndpoint("screenshot-apply")');
    expect(platformShellHtml).toContain("file.size > screenshotMaxBytes");
    expect(platformShellHtml).toContain('teamName.includes("...") || teamName.includes(String.fromCharCode(8230))');
    expect(platformShellHtml).not.toContain("/...|…/u.test(teamName)");
    expect(platformShellHtml).toContain("abbreviation.length > 12");
    expect(platformShellHtml).toContain("workspaceRequestGeneration");
    expect(platformShellHtml).toContain("isCurrentSetupRequest(seasonId, requestGeneration)");
    expect(platformShellHtml).toContain("resetScreenshotReview({ clearFile: true, clearStatus: true })");
    expect(platformShellHtml).toContain("teams.length + \" teams configured.\"");
    expect(platformShellHtml).toContain('fetch("/seasons/" + encodeURIComponent(selectedLeague.seasonId)');
    expect(platformShellHtml).toContain("setupImport.records || []");
    expect(platformShellHtml).toContain("id=\"setup-invitations\"");
    expect(platformShellHtml).toContain("id=\"invitation-team-picker\"");
    expect(platformShellHtml).toContain("id=\"invitation-email-input\"");
    expect(platformShellHtml).toContain("id=\"create-invitation-button\"");
    expect(platformShellHtml).toContain('fetch("/invitations",');
    expect(platformShellHtml).toContain("id=\"create-live-room-button\"");
    expect(platformShellHtml).toContain("id=\"cancel-live-room-button\"");
    expect(platformShellHtml).toContain('method: "DELETE"');
    expect(platformShellHtml).toContain("Cancel this unstarted draft room?");
    expect(platformShellHtml).toContain("id=\"publish-season-button\"");
    expect(platformShellHtml).toContain("id=\"setup-final-review\"");
    expect(platformShellHtml).toContain("I reviewed the teams, draft settings, roster rules, history, and keepers.");
    expect(platformShellHtml).toContain("JSON.stringify({ confirmed: setupFinalReview.checked })");
    expect(platformShellHtml).toContain('encodeURIComponent(selectedLeague.seasonId) + "/publish"');
    expect(platformShellHtml).toContain("id=\"open-setup-live-room\"");
    expect(platformShellHtml).toContain("state.setupLocked = hasRoom");
    expect(platformShellHtml).toContain("setupRowsInput.disabled = hasRoom");
    expect(platformShellHtml).toContain("Team assignments are locked after the live draft room is created.");
    expect(platformShellHtml).toContain('fetch("/seasons/" + encodeURIComponent(selectedLeague.seasonId) + "/live-room"');
    expect(platformShellHtml).toContain("window.location.assign(draftRoomPathFor(selectedLeague.seasonId, room.roomId))");
    expect(platformShellHtml).toContain("fetch(\"/invitations?seasonId=\"");
    expect(platformShellHtml).toContain("Copy invite link");
    expect(platformShellHtml).toContain("Reissue");
    expect(platformShellHtml).toContain("No invitations yet.");
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
    expect(platformShellHtml).toContain("@media (max-width: 700px)");
    expect(platformShellHtml).toContain("max-height: min(58vh, 520px)");
    expect(platformShellHtml).toContain(".mock-roster-panel { order: -1; }");
    expect(platformShellHtml).toContain('.player-board td[data-label]::before');
    expect(platformShellHtml).not.toContain("class=\"cards\"");
    expect(platformShellHtml).not.toContain("Draft command center");
  });

  it("keeps league creation available and honors the explicit create route", () => {
    expect(platformShellHtml).toContain('id="create-league-nav-item"');
    expect(platformShellHtml).toContain('href="/league?create=1"');
    expect(platformShellHtml).toContain('routePath === "/league" && search.get("create") === "1"');
    [
      "league-create-pass-yard",
      "league-create-pass-td",
      "league-create-rush-yard",
      "league-create-rush-td",
      "league-create-receive-yard",
      "league-create-receive-td",
      "league-create-ppr",
    ].forEach(fieldId => expect(platformShellHtml).toContain(`id="${fieldId}"`));
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
