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

  it("renders the complete shared board, selected team, and recent sales", () => {
    expect(hostedDraftRoomHtml).toContain("const visiblePlayers = model.board.filter");
    expect(hostedDraftRoomHtml).toContain("visiblePlayers.forEach(player =>");
    expect(hostedDraftRoomHtml).toContain('playerRowFor(player, "desktop")');
    expect(hostedDraftRoomHtml).toContain('playerRowFor(player, "mobile")');
    expect(hostedDraftRoomHtml).toContain('model.selectedTeam?.teamId');
    expect(hostedDraftRoomHtml).toContain('model.viewedTeam?.teamId');
    expect(hostedDraftRoomHtml).toContain("model.salesLog");
    expect(hostedDraftRoomHtml).not.toContain("renderModel(fallbackModelFor(state.room))");
    expect(hostedDraftRoomHtml).toContain('id="draft-team-select"');
    expect(hostedDraftRoomHtml).toContain('id="draft-team-roster"');
    expect(hostedDraftRoomHtml).toContain('id="draft-board-count"');
    expect(hostedDraftRoomHtml).toContain("loaded");
  });

  it("uses server roles and revisions for commissioner lifecycle and sale mutations", () => {
    expect(hostedDraftRoomHtml).toContain("model.canMutateRoom === true");
    expect(hostedDraftRoomHtml).toContain("commissionerControls.hidden = !canManage");
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
    expect(hostedDraftRoomHtml).toContain("recentSales.some(sale => sale.saleEventId === state.correctionSaleId)");
    expect(hostedDraftRoomHtml).toContain('team.ownerDisplayName + " " + player.name + " "');
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
    expect(hostedDraftRoomHtml).toContain("window.addEventListener(\"online\"");
    expect(hostedDraftRoomHtml).toContain("window.addEventListener(\"offline\"");
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
    expect(hostedDraftRoomHtml).toContain('grid-template-areas: "status" "sales" "team" "board";');
    expect(hostedDraftRoomHtml).toContain("min-height: 44px");
    expect(hostedDraftRoomHtml).toContain(".desktop-board");
    expect(hostedDraftRoomHtml).toContain(".mobile-board");
    expect(hostedDraftRoomHtml).toContain("overflow-wrap: anywhere");
    expect(hostedDraftRoomHtml).not.toContain("100vh");
  });
});
