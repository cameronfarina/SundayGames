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
      ["Practice", "/practice"],
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
    expect(platformShellHtml).toContain(': "/practice";');
    expect(platformShellHtml).toContain("setHidden(authModePrompt, false)");
    expect(platformShellHtml).toContain("invitationToken: signupInvitationToken()");
    expect(platformShellHtml).toContain("returnTo: authenticationReturnPath()");
    expect(platformShellHtml).toContain('"&returnTo=" + encodeURIComponent(authenticationReturnPath())');
    expect(platformShellHtml).toContain("minlength=\"8\"");
    expect(platformShellHtml).toContain("autocomplete=\"new-password\"");
  });

  it("bootstraps durable league and team identity before enabling workspaces", () => {
    expect(platformShellHtml).toContain("fetch(\"/onboarding\"");
    expect(platformShellHtml).toContain('id="header-league-picker"');
    expect(platformShellHtml).toContain('search.get("seasonId") || search.get("contextSeasonId")');
    expect(platformShellHtml).toContain('query.delete("mockSessionId")');
    expect(platformShellHtml).toContain('id="account-menu-button"');
    expect(platformShellHtml).toContain('id="account-avatar-initials"');
    expect(platformShellHtml).toContain('id="account-menu-leagues"');
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
    expect(platformShellHtml).toContain("renderLeagueOverview(body.season, keepersBody.keepers || [])");
    expect(platformShellHtml).toContain("isCurrentWorkspaceRequest(overviewSeasonId, overviewRequestGeneration)");
    expect(platformShellHtml).toContain("updateNavigationForNoLeague()");
    expect(platformShellHtml).toContain('item.path === "/my-team"');
  });

  it("keeps the full player board useful before a user creates or joins a league", () => {
    expect(platformShellHtml).toContain('id="standalone-board"');
    expect(platformShellHtml).toContain('id="standalone-player-search" type="search"');
    expect(platformShellHtml).toContain('id="standalone-position-filter"');
    expect(platformShellHtml).toContain('id="standalone-board-sort"');
    expect(platformShellHtml).toContain('<option value="mine">My value</option>');
    expect(platformShellHtml).toContain('id="practice-strategy"');
    expect(platformShellHtml).toContain('id="standalone-pricing-source"');
    expect(platformShellHtml).toContain('id="standalone-pricing-warnings"');
    expect(platformShellHtml).toContain('body.personalized === true ? "mine" : "market"');
    expect(platformShellHtml).toContain('displayRank: index + 1');
    expect(platformShellHtml).toContain('player.pricingWarnings.filter');
    expect(platformShellHtml).toContain('id="standalone-player-rows"');
    expect(platformShellHtml).toContain('id="standalone-player-scroll" class="table-scroll player-board-scroll"');
    expect(platformShellHtml).toContain('const endpoint = seasonId');
    expect(platformShellHtml).toContain('"/player-catalog?seasonId="');
    expect(platformShellHtml).toContain("boardRequestGeneration");
    expect(platformShellHtml).toContain("requestGeneration !== state.boardRequestGeneration");
    expect(platformShellHtml).toContain('routePath === "/practice"');
    expect(platformShellHtml).not.toContain('id="standalone-board-open-live"');
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
    expect(platformShellHtml).toContain('id="league-create-screenshot-panel"');
    expect(platformShellHtml).toContain('id="league-create-screenshot-dropzone"');
    expect(platformShellHtml).toContain('id="league-create-screenshot-file"');
    expect(platformShellHtml).toContain('id="league-create-screenshot-analyze"');
    expect(platformShellHtml).toContain('fetch("/league-imports/espn/members-screenshot-review"');
    expect(platformShellHtml).toContain('addEventListener("dragover"');
    expect(platformShellHtml).toContain('addEventListener("drop"');
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
    expect(platformShellHtml).toContain('id="historical-import-file" class="hidden" type="file" multiple');
    expect(platformShellHtml).toContain('id="historical-import-dropzone"');
    expect(platformShellHtml).toContain('id="historical-import-file-list"');
    expect(platformShellHtml).toContain('id="historical-import-button"');
    expect(platformShellHtml).toContain('addEventListener("drop"');
    expect(platformShellHtml).toContain("historicalImportFiles.forEach");
    expect(platformShellHtml).toContain("inferHistoricalImportYear");
    expect(platformShellHtml).toContain("match(/(?:19|20)\\d{2}/gu)");
    expect(platformShellHtml).toContain("const fileBase64For = file =>");
    expect(platformShellHtml).toContain("base64: await fileBase64For(item.file)");
    expect(platformShellHtml).not.toContain("imageBase64For");
    expect(platformShellHtml).toContain("importHistoricalFile");
    expect(platformShellHtml).toContain("duplicateHistoricalImportYears");
    expect(platformShellHtml).toContain("Each selected file needs a different draft year");
    expect(platformShellHtml).toContain("Draft history is saved. Market now blends baseline projections with up to three years of open-auction sales; keeper rows are excluded. Files with same-season public/AAV values also improve player-level estimates.");
    expect(platformShellHtml).toContain("Public/AAV values affect league calibration only within the three-year window ending with the latest imported draft season.");
    expect(platformShellHtml).toContain("Match historical team names");
    expect(platformShellHtml).toContain("normalizeHistoricalOwnerLabel");
    expect(platformShellHtml).toContain("sharedHistoricalOwnerMappings");
    expect(platformShellHtml).toContain("ownerMappings: historicalOwnerMappingsFor(item)");
    expect(platformShellHtml).toContain("requireCompleteTeamMapping: true");
    expect(platformShellHtml).toContain("historicalOwnerMappingAlreadyRendered");
    expect(platformShellHtml).toContain("This file does not match the current league's team count.");
    expect(platformShellHtml).toContain("inferFirstRosterRowAsKeeper: historicalRowOneKeepersInput.checked");
    expect(platformShellHtml).toContain('blocker.code === "owner_unknown" || blocker.code === "owner_ambiguous"');
    expect(platformShellHtml).toContain('select.dataset.historicalOwnerFile = item.id');
    expect(platformShellHtml).toContain("player-name warning");
    expect(platformShellHtml).toContain("playerResolutionIssues");
    expect(platformShellHtml).not.toContain("League values were recalibrated from");
    expect(platformShellHtml).toContain('"/historical-imports/" + encodeURIComponent(batch.id) + "/commit"');
    expect(platformShellHtml).not.toContain('id="historical-preview-button"');
    expect(platformShellHtml).not.toContain('id="historical-commit-button"');
    expect(platformShellHtml).not.toContain('id="historical-import-preview-body"');
    expect(platformShellHtml).not.toContain("Review file");
    expect(platformShellHtml).toContain('id="keeper-command-input"');
    expect(platformShellHtml).toContain('id="keeper-command-form"');
    expect(platformShellHtml).toContain('id="keeper-add-button"');
    expect(platformShellHtml).not.toContain('id="keeper-preview-button"');
    expect(platformShellHtml).not.toContain('id="keeper-apply-button"');
    expect(platformShellHtml).toContain('id="keeper-save-state"');
    expect(platformShellHtml).toContain("Keepers save automatically");
    expect(platformShellHtml).toContain('itemCountLabel(keepers.length, "keeper") + " saved"');
    expect(platformShellHtml).toContain("const draftHasStarted = hasRoom && !roomIsUnstarted");
    expect(platformShellHtml).toContain("keeperCommandInput.disabled = draftHasStarted");
    expect(platformShellHtml).toContain('keeperCommandForm.addEventListener("submit"');
    expect(platformShellHtml).toContain('body: JSON.stringify({ command: command, confirmed: true })');
    expect(platformShellHtml).toContain('body.preview.team.name + " keeps " + body.preview.player.name');
    expect(platformShellHtml).toContain('"League values and the draft room are updated."');
    expect(platformShellHtml).toContain('"League values are updated."');
    expect(platformShellHtml).toContain('body.room\n          ? "Removed and saved. League values and the draft room are updated."');
    expect(platformShellHtml).toContain('id="simulation-panel"');
    expect(platformShellHtml).toContain('id="standalone-board-open-simulations"');
    expect(platformShellHtml).toContain('id="standalone-shortlist-only"');
    expect(platformShellHtml).toContain('id="standalone-shortlist-count"');
    expect(platformShellHtml).toContain('fetch("/practice-shortlist"');
    expect(platformShellHtml).toContain('"/practice-shortlist?seasonId="');
    expect(platformShellHtml).toContain('className = "shortlist-toggle"');
    expect(platformShellHtml).toContain("simulationPanel.open = true");
    expect(platformShellHtml).toContain('id="simulation-count"');
    expect(platformShellHtml).toContain('id="simulation-strategy"');
    expect(platformShellHtml).toContain('fetch("/season-simulations"');
    expect(platformShellHtml).toContain("strategyPreset: practiceStrategy.value");
    expect(platformShellHtml).toContain('id="simulation-target-rate"');
    expect(platformShellHtml).toContain('id="simulation-run-picker"');
    expect(platformShellHtml).toContain('id="simulation-league-grid"');
    expect(platformShellHtml).toContain('simulation.runs || []');
    expect(platformShellHtml).toContain('if (!isCurrentWorkspaceRequest(seasonId, requestGeneration)) return;');
    expect(platformShellHtml).toContain('state.playerCatalog = null;');
    expect(platformShellHtml).toContain('state.playerCatalogMeta = null;');
    expect(platformShellHtml).not.toContain('Representative roster');
    expect(platformShellHtml).toContain('id="my-team-claim-link"');
    expect(platformShellHtml).toContain('myTeamClaimLink.href = pathWithSeason("/league"');
    expect(platformShellHtml).not.toContain("Accept an invitation from your commissioner to join your league.");
    expect(platformShellHtml).toContain("Create a league as commissioner, or join one from an invitation.");
    expect(platformShellHtml).not.toContain("Use the email address where your league invitation was sent.");
    expect(platformShellHtml).toContain('get("account") === "password"');
    expect(platformShellHtml).toContain("const openPasswordDialog = () =>");
  });

  it("runs claimed teams through one league-aware mock draft workspace", () => {
    expect(platformShellHtml).toContain('id="mock-draft-workspace"');
    expect(platformShellHtml).toContain('id="mock-draft-player-rows"');
    expect(platformShellHtml).toContain('id="mock-draft-roster"');
    expect(platformShellHtml).toContain('id="mock-draft-roster-team"');
    expect(platformShellHtml).toContain('id="mock-draft-roster-facts"');
    expect(platformShellHtml).toContain('id="mock-roster-budget-left"');
    expect(platformShellHtml).toContain('id="mock-roster-max-bid"');
    expect(platformShellHtml).toContain('id="mock-draft-position-filters"');
    expect(platformShellHtml).toContain('data-mock-position="FLEX"');
    expect(platformShellHtml).toContain('id="mock-draft-results"');
    expect(platformShellHtml).toContain('id="mock-draft-results-grid"');
    expect(platformShellHtml).toContain('id="mock-draft-player-scroll" class="table-scroll player-board-scroll"');
    expect(platformShellHtml).toContain('class="workspace-section mock-roster-panel"');
    expect(platformShellHtml).toContain('id="mock-draft-buy"');
    expect(platformShellHtml).toContain('id="mock-draft-pass"');
    expect(platformShellHtml).toContain('id="mock-draft-budget-left"');
    expect(platformShellHtml).toContain('id="mock-draft-open-slots"');
    expect(platformShellHtml).toContain('id="mock-draft-max-bid"');
    expect(platformShellHtml).toContain('id="mock-auction-stage"');
    expect(platformShellHtml).toContain('id="mock-auction-player"');
    expect(platformShellHtml).toContain('id="mock-auction-current-bid"');
    expect(platformShellHtml).toContain('id="mock-auction-high-bidder"');
    expect(platformShellHtml).toContain('id="mock-auction-countdown"');
    expect(platformShellHtml).toContain('id="mock-auction-feed"');
    expect(platformShellHtml).toContain("draft.auctionEvents || []");
    expect(platformShellHtml).toContain("selectMockAuctionEventsForAnimation");
    expect(platformShellHtml).toContain("groupedEvents.length <= 2");
    expect(platformShellHtml).toContain("groupedEvents.at(-1)");
    expect(platformShellHtml).toContain(".workspace > * { min-width: 0; }");
    expect(platformShellHtml).toContain(".mock-auction-stage > * { min-width: 0; }");
    expect(platformShellHtml).toContain("myTeam.maxBid");
    expect(platformShellHtml).toContain("myTeam.rosterSlotsRemaining");
    expect(platformShellHtml).toContain('label: "NFL"');
    expect(platformShellHtml).toContain('label: "Bye"');
    expect(platformShellHtml).toContain('label: "Our value"');
    expect(platformShellHtml).toContain('className = "position-label"');
    expect(platformShellHtml).toContain('mockDraftRoster.dataset.teamId = rosterTeam?.id || ""');
    expect(platformShellHtml).toContain('state.mockRosterTeamId = mockDraftRosterTeam.value');
    expect(platformShellHtml).toContain("mockPositionFilter");
    expect(platformShellHtml).toContain("renderMockDraftResults");
    expect(platformShellHtml).toContain("player.week1Points || 0");
    expect(platformShellHtml).toContain('setHidden(mockDraftResults, sessionState.status !== "completed")');
    expect(platformShellHtml).toContain('setHidden(mockDraftStart, sessionState.status !== "setup")');
    expect(platformShellHtml).toContain('fetch("/season-mock-drafts"');
    expect(platformShellHtml).toContain("strategy: requestedStrategy");
    expect(platformShellHtml).toContain("strategy: practiceStrategy.value");
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
    expect(platformShellHtml).not.toContain("id=\"screenshot-import-file\"");
    expect(platformShellHtml).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(platformShellHtml).not.toContain("id=\"screenshot-analyze-button\"");
    expect(platformShellHtml).toContain("Your entire selected image is sent to OpenAI for analysis.");
    expect(platformShellHtml).toContain("remove invite links and email addresses");
    expect(platformShellHtml).toContain("Mockd retains only the team number, abbreviation, team name, and manager names you approve.");
    expect(platformShellHtml).not.toContain("id=\"screenshot-review-table\"");
    expect(platformShellHtml).not.toContain("id=\"screenshot-apply-button\"");
    expect(platformShellHtml).toContain("file.size > screenshotMaxBytes");
    expect(platformShellHtml).toContain('teamName.includes("...") || teamName.includes(String.fromCharCode(8230))');
    expect(platformShellHtml).not.toContain("/...|…/u.test(teamName)");
    expect(platformShellHtml).toContain("abbreviation.length > 12");
    expect(platformShellHtml).toContain("workspaceRequestGeneration");
    expect(platformShellHtml).toContain("isCurrentSetupRequest(seasonId, requestGeneration)");
    expect(platformShellHtml).toContain("teams.length + \" teams configured.\"");
    expect(platformShellHtml).toContain('fetch("/seasons/" + encodeURIComponent(selectedLeague.seasonId)');
    expect(platformShellHtml).toContain("setupImport.records || []");
    expect(platformShellHtml).toContain("id=\"league-invite-link-input\"");
    expect(platformShellHtml).toContain("id=\"copy-league-invite-button\"");
    expect(platformShellHtml).toContain("id=\"create-league-invite-button\"");
    expect(platformShellHtml).not.toContain("id=\"invitation-team-picker\"");
    expect(platformShellHtml).not.toContain("id=\"invitation-email-input\"");
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
    expect(platformShellHtml).toContain("Keepers and draft history remain editable until the draft starts.");
    expect(platformShellHtml).toContain('fetch("/seasons/" + encodeURIComponent(selectedLeague.seasonId) + "/live-room"');
    expect(platformShellHtml).toContain("window.location.assign(draftRoomPathFor(selectedLeague.seasonId, room.roomId))");
    expect(platformShellHtml).toContain("fetch(\"/invitations?seasonId=\"");
    expect(platformShellHtml).toContain("Share one link with your group.");
    expect(platformShellHtml).toContain("Copy link");
    expect(platformShellHtml).toContain("Generate new link");
    expect(platformShellHtml).toContain("id=\"invite-team-list\"");
    expect(platformShellHtml).toContain("Join as this team");
    expect(platformShellHtml).toContain('"/invitations/details?token=" + encodeURIComponent(token)');
    expect(platformShellHtml).toContain("fetch(\"/invitations/claim\"");
    expect(platformShellHtml).not.toContain("fetch(\"/invitations/accept\"");
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
    expect(platformShellHtml).not.toContain('id="create-league-nav-item"');
    expect(platformShellHtml).toContain('id="account-create-league"');
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

  it("puts team claiming and actionable readiness before league details", () => {
    const claimIndex = platformShellHtml.indexOf('id="team-claim-panel"');
    const readinessIndex = platformShellHtml.indexOf('aria-label="League readiness"');
    const settingsIndex = platformShellHtml.indexOf('id="league-overview-title"');

    expect(claimIndex).toBeGreaterThan(-1);
    expect(claimIndex).toBeLessThan(readinessIndex);
    expect(readinessIndex).toBeLessThan(settingsIndex);
    expect(platformShellHtml).toContain('id="league-setup-readiness-action"');
    expect(platformShellHtml).toContain('id="team-claim-readiness-action"');
    expect(platformShellHtml).toContain('id="live-draft-readiness-action"');
  });

  it("offers league and account controls from the avatar menu", () => {
    expect(platformShellHtml).toContain('id="account-settings-button"');
    expect(platformShellHtml).toContain('id="account-menu"');
    expect(platformShellHtml).toContain('id="sign-out-button"');
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

  it("keeps live drafting on League and shows keepers with league teams", () => {
    const practiceStart = platformShellHtml.indexOf('id="standalone-board"');
    const practiceEnd = platformShellHtml.indexOf('id="empty-leagues"');
    const practiceMarkup = platformShellHtml.slice(practiceStart, practiceEnd);

    expect(practiceMarkup).not.toContain("Live draft");
    expect(platformShellHtml).toContain('id="open-live-draft-button"');
    expect(platformShellHtml).toContain('<th>Keepers</th>');
    expect(platformShellHtml).toContain('renderLeagueOverview(body.season, keepersBody.keepers || [])');
  });
});
