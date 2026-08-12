import { describe, expect, it } from "vitest";

import {
  hostedDraftRoomHtml,
  platformHostedDraftRoomHtml,
} from "../src/platform/hostedDraftRoomUi.js";

describe("platform hosted draft room UI", () => {
  it("exposes the stable, accessible browser release-gate controls", () => {
    expect(platformHostedDraftRoomHtml).toBe(hostedDraftRoomHtml);
    expect(hostedDraftRoomHtml).toContain('id="draft-room-view" data-platform-live-room');

    for (const selector of [
      "draft-room-status",
      "draft-connection-status",
      "draft-sale-command",
      "draft-log-sale",
      "draft-start",
      "draft-undo",
      "draft-end",
      "draft-export",
      "draft-sales",
    ]) {
      expect(hostedDraftRoomHtml).toContain(`id="${selector}"`);
    }

    expect(hostedDraftRoomHtml).toContain('for="draft-sale-command"');
    expect(hostedDraftRoomHtml).toContain('id="draft-room-status" role="status"');
    expect(hostedDraftRoomHtml).toContain('id="draft-connection-status" role="status"');
    expect(hostedDraftRoomHtml).toContain('id="draft-sales" aria-live="polite"');
    expect(hostedDraftRoomHtml).toContain('row.dataset.playerName = player.name;');
  });

  it("boots only from the authenticated platform route and canonical APIs", () => {
    expect(hostedDraftRoomHtml).toContain('query.get("seasonId")');
    expect(hostedDraftRoomHtml).toContain('query.get("roomId")');
    expect(hostedDraftRoomHtml).toContain('fetch("/session", getRequest)');
    expect(hostedDraftRoomHtml).toContain('fetch(seasonEndpoint(), getRequest)');
    expect(hostedDraftRoomHtml).toContain('fetch(roomEndpoint(), getRequest)');
    expect(hostedDraftRoomHtml).toContain('roomEndpoint("events") + "?afterRevision=0"');
    expect(hostedDraftRoomHtml).toContain('credentials: "same-origin"');

    for (const forbidden of [
      "localStorage",
      "sessionToken",
      "viewerPassword",
      "commissioner-secret",
      "/api/rooms",
      "localhost",
      "local demo",
    ]) {
      expect(hostedDraftRoomHtml).not.toContain(forbidden);
    }
  });

  it("keeps league and account recovery controls available in the room header", () => {
    expect(hostedDraftRoomHtml).toContain('id="draft-league-home" href="/league"');
    expect(hostedDraftRoomHtml).toContain('byId("draft-league-home").href = "/league" + seasonQuery;');
    expect(hostedDraftRoomHtml).toContain('id="draft-sign-out"');
    expect(hostedDraftRoomHtml).toContain('id="draft-league-picker"');
    expect(hostedDraftRoomHtml).toContain('id="draft-account-avatar"');
    expect(hostedDraftRoomHtml).toContain('fetch("/onboarding", getRequest)');
    expect(hostedDraftRoomHtml).toContain('fetch("/session", {');
    expect(hostedDraftRoomHtml).toContain('method: "DELETE"');
    expect(hostedDraftRoomHtml).toContain('window.location.assign("/login")');
    expect(hostedDraftRoomHtml).toContain('id="draft-sign-in-link"');
    expect(hostedDraftRoomHtml).toContain('window.location.pathname + window.location.search');
    expect(hostedDraftRoomHtml).toContain('"/login?returnTo=" + encodeURIComponent(returnTo)');
  });

  it("replaces the loading dashboard with clear recovery actions after a fatal load error", () => {
    expect(hostedDraftRoomHtml).toContain('id="draft-room-content"');
    expect(hostedDraftRoomHtml).toContain('id="draft-fatal-error" role="alert" hidden');
    expect(hostedDraftRoomHtml).toContain('id="draft-sign-in-link" href="/login"');
    expect(hostedDraftRoomHtml).toContain('id="draft-fatal-league-home" href="/app"');
    expect(hostedDraftRoomHtml).toContain("roomContent.hidden = true;");
    expect(hostedDraftRoomHtml).toContain("signInLink.hidden = false;");
    expect(hostedDraftRoomHtml).toContain('roomTitle.textContent = "Draft room unavailable";');
  });

  it("renders the complete shared board, selected team, and full searchable sale ledger", () => {
    expect(hostedDraftRoomHtml).toContain("const visiblePlayers = model.board.filter");
    expect(hostedDraftRoomHtml).toContain("visiblePlayers.forEach(player =>");
    expect(hostedDraftRoomHtml).toContain('playerRowFor(player, "desktop", canManage)');
    expect(hostedDraftRoomHtml).toContain('playerRowFor(player, "mobile", canManage)');
    expect(hostedDraftRoomHtml).toContain('model.selectedTeam?.teamId');
    expect(hostedDraftRoomHtml).toContain('model.viewedTeam?.teamId');
    expect(hostedDraftRoomHtml).toContain("model.salesLog");
    expect(hostedDraftRoomHtml).not.toContain("renderModel(fallbackModelFor(state.room))");
    expect(hostedDraftRoomHtml).toContain('id="draft-team-select"');
    expect(hostedDraftRoomHtml).toContain('id="draft-team-roster"');
    expect(hostedDraftRoomHtml).toContain('id="draft-board-count"');
    expect(hostedDraftRoomHtml).toContain("loaded");
    expect(hostedDraftRoomHtml).toContain('{ label: "Baseline", className: "money" }');
    expect(hostedDraftRoomHtml).toContain('{ label: "Market", className: "money" }');
    expect(hostedDraftRoomHtml).not.toContain('{ label: "My value", className: "money" }');
    expect(hostedDraftRoomHtml).toContain('market.textContent = "Baseline "');
    expect(hostedDraftRoomHtml).toContain('price.textContent = "Market "');
    expect(hostedDraftRoomHtml).toContain('<h2 id="draft-sales-heading">All sales</h2>');
    expect(hostedDraftRoomHtml).toContain('id="draft-sales-search" type="search"');
    expect(hostedDraftRoomHtml).toContain('class="sales-scroll"');
    expect(hostedDraftRoomHtml).toContain("const allSales = (model.salesLog || []).slice().reverse();");
    expect(hostedDraftRoomHtml).toContain("allSales.filter(sale =>");
    expect(hostedDraftRoomHtml).toContain('salesSearch.addEventListener("input"');
    expect(hostedDraftRoomHtml).not.toContain(".reverse().slice(0, 12)");
  });

  it("uses server roles and revisions for commissioner lifecycle and sale mutations", () => {
    expect(hostedDraftRoomHtml).toContain("model.canMutateRoom === true");
    expect(hostedDraftRoomHtml).toContain("commissionerControls.hidden = !canManage || isComplete");
    expect(hostedDraftRoomHtml).toContain('id="draft-pause"');
    expect(hostedDraftRoomHtml).toContain('id="draft-correction-form"');
    expect(hostedDraftRoomHtml).toContain('mutateRoom("start"');
    expect(hostedDraftRoomHtml).toContain('? "resume" : "pause"');
    expect(hostedDraftRoomHtml).toContain('mutateRoom("sales"');
    expect(hostedDraftRoomHtml).toContain('mutateRoom("undo"');
    expect(hostedDraftRoomHtml).toContain('mutateRoom("corrections"');
    expect(hostedDraftRoomHtml).toContain("{ saleEventId, replacementSale: command }");
    expect(hostedDraftRoomHtml).toContain('mutateRoom("end"');
    expect(hostedDraftRoomHtml).toContain("fetch(roomEndpoint(action)");
    expect(hostedDraftRoomHtml).toContain("expectedRevision: currentRevision()");
    expect(hostedDraftRoomHtml).toContain("idempotencyKey:");
    expect(hostedDraftRoomHtml).toContain("window.confirm");
    expect(hostedDraftRoomHtml).toContain("undoButton.disabled = !canManage || !isLive || !hasSales");
    expect(hostedDraftRoomHtml).toContain('model.canMutateRoom === true && model.status === "live"');
    expect(hostedDraftRoomHtml).toContain("state.mutationPending = true");
    expect(hostedDraftRoomHtml).toContain("state.mutationPending = false");
    expect(hostedDraftRoomHtml).not.toContain("canCorrect && index === 0");
    expect(hostedDraftRoomHtml).toContain("allSales.some(sale => sale.saleEventId === state.correctionSaleId)");
    expect(hostedDraftRoomHtml).toContain('team.ownerDisplayName + " " + player.name + " "');
  });

  it("replaces active controls with post-draft actions when the room is complete", () => {
    expect(hostedDraftRoomHtml).toContain('id="draft-complete-actions" hidden');
    expect(hostedDraftRoomHtml).toContain('id="draft-view-my-team" href="/my-team"');
    expect(hostedDraftRoomHtml).toContain('id="draft-export" type="button" disabled hidden>Export results CSV</button>');
    expect(hostedDraftRoomHtml).toContain('"/my-team?seasonId=" + encodeURIComponent(seasonId)');
    expect(hostedDraftRoomHtml).toContain("commissionerControls.hidden = !canManage || isComplete;");
    expect(hostedDraftRoomHtml).toContain("completeActions.hidden = !isComplete;");
    expect(hostedDraftRoomHtml).toContain('viewMyTeamLink.hidden = model.role === "observer";');
    expect(hostedDraftRoomHtml).toContain("exportButton.hidden = !canManage || !isComplete;");
    expect(hostedDraftRoomHtml).toContain("Open My Team to see your final roster and which analysis is available.");
    expect(hostedDraftRoomHtml).not.toContain("draft rank, and coach review are ready");
  });

  it("does not render board sale actions for members or observers", () => {
    expect(hostedDraftRoomHtml).toContain("const canManage = model.canMutateRoom === true;");
    expect(hostedDraftRoomHtml).toContain("renderBoardHeader(canManage);");
    expect(hostedDraftRoomHtml).toContain('playerRowFor(player, "desktop", canManage)');
    expect(hostedDraftRoomHtml).toContain('playerRowFor(player, "mobile", canManage)');
    expect(hostedDraftRoomHtml).toContain("if (canManage) row.appendChild(usePlayerButtonFor(player));");
    expect(hostedDraftRoomHtml).toContain('if (canManage) {\n        const useCell = document.createElement("td");');
    expect(hostedDraftRoomHtml).toContain("row.appendChild(useCell);");
    expect(hostedDraftRoomHtml).toContain('row.classList.toggle("player-card-actionable", canManage);');
    expect(hostedDraftRoomHtml).toContain("cell.colSpan = canManage ? 7 : 6;");
    expect(hostedDraftRoomHtml).toContain(".player-card-actionable");
  });

  it("keeps an explicit connection state and recovers missed revisions", () => {
    expect(hostedDraftRoomHtml).toContain("new EventSource(");
    expect(hostedDraftRoomHtml).toContain('roomEndpoint("event-stream")');
    expect(hostedDraftRoomHtml).toContain('roomEndpoint("events")');
    expect(hostedDraftRoomHtml).toContain('eventSource.addEventListener("room.snapshot"');
    expect(hostedDraftRoomHtml).toContain('eventSource.addEventListener("room.sale"');
    expect(hostedDraftRoomHtml).toContain('eventSource.addEventListener("room.paused"');
    expect(hostedDraftRoomHtml).toContain('eventSource.addEventListener("room.resumed"');
    expect(hostedDraftRoomHtml).not.toContain('eventSource.addEventListener("room.corrected"');
    expect(hostedDraftRoomHtml).toContain('setConnectionState("connected"');
    expect(hostedDraftRoomHtml).toContain('setConnectionState("reconnecting"');
    expect(hostedDraftRoomHtml).toContain('setConnectionState("offline"');
    expect(hostedDraftRoomHtml).toContain('await loadSnapshot();\n        setConnectionState("connected", "Connected");\n        connectRoomUpdates();');
    expect(hostedDraftRoomHtml).not.toContain('setConnectionState("connected", "Live")');
    expect(hostedDraftRoomHtml).toContain("window.addEventListener(\"online\"");
    expect(hostedDraftRoomHtml).toContain("window.addEventListener(\"offline\"");
  });

  it("shows useful draft progress instead of implementation revisions", () => {
    expect(hostedDraftRoomHtml).toContain("Draft progress");
    expect(hostedDraftRoomHtml).toContain('id="draft-progress"');
    expect(hostedDraftRoomHtml).toContain("team.roster.length + team.rosterSlotsRemaining");
    expect(hostedDraftRoomHtml).toContain('sales.length + " sales · " + filledRosterSpots + " of " + totalRosterSpots + " spots filled"');
    expect(hostedDraftRoomHtml).not.toContain("<span>Revision</span>");
    expect(hostedDraftRoomHtml).not.toContain('id="draft-revision"');
  });

  it("uses the shared Mockd product navigation and visual tokens", () => {
    expect(hostedDraftRoomHtml).toContain('--accent: #67d8b0;');
    expect(hostedDraftRoomHtml).toContain('<a class="brand" id="draft-brand" href="/practice">Mockd</a>');
    expect(hostedDraftRoomHtml).toContain('class="product-nav" aria-label="Primary"');
    expect(hostedDraftRoomHtml).toContain('id="draft-nav-practice" href="/practice">Practice</a>');
    expect(hostedDraftRoomHtml).toContain('id="draft-league-home"');
    expect(hostedDraftRoomHtml).toContain('id="draft-nav-my-team"');
    expect(hostedDraftRoomHtml).toContain('aria-current="page">Live draft</span>');
    expect(hostedDraftRoomHtml).not.toContain('>Board</a>');
  });

  it("exports authoritative results without exposing private preparation fields", () => {
    expect(hostedDraftRoomHtml).toContain('roomEndpoint("export-artifacts")');
    expect(hostedDraftRoomHtml).toContain("URL.createObjectURL");
    expect(hostedDraftRoomHtml).toContain('download =');

    for (const privateField of [
      "shortlist",
      "strategy",
      "personalValue",
      "maxBid",
      "privateNote",
    ]) {
      expect(hostedDraftRoomHtml).not.toContain(privateField);
    }
  });

  it("has a deliberate 390px hierarchy and touch-sized controls", () => {
    expect(hostedDraftRoomHtml).toContain("@media (max-width: 700px)");
    expect(hostedDraftRoomHtml).toContain('grid-template-areas: "status" "board" "team" "sales";');
    expect(hostedDraftRoomHtml).toContain("min-height: 44px");
    expect(hostedDraftRoomHtml).toContain(".desktop-board");
    expect(hostedDraftRoomHtml).toContain(".mobile-board");
    expect(hostedDraftRoomHtml).toContain("max-height: 58vh;");
    expect(hostedDraftRoomHtml).toContain("overflow-wrap: anywhere");
    expect(hostedDraftRoomHtml).not.toContain("100vh");
  });
});
