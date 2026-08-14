import { leagueConfig, ownerOrder } from "../../config/league.js";
import { buildCurrentMockdLeagueSeason } from "../../src/platform/leagueSeason.js";
import {
  InMemoryLiveDraftRoomRepository,
  type LiveDraftRoom,
  type LiveDraftRoomActor,
  type LiveDraftRoomInitialRosterPlayer,
  type LiveDraftRoomPlayerCatalogEntry,
} from "../../src/platform/liveDraftRooms.js";

const now = new Date("2026-08-09T12:00:00.000Z");

export const persistedLiveDraftRooms = (): readonly LiveDraftRoom[] => {
  const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    setupStatus: "published",
  });
  const team = season.teams[0];
  if (team === undefined) throw new Error("Expected a seeded team.");
  const actor: LiveDraftRoomActor = {
    userId: "user-cam",
    leagueId: season.leagueId,
    role: "admin",
  };
  const catalog: readonly LiveDraftRoomPlayerCatalogEntry[] = [
    {
      name: "Puka Nacua",
      position: "WR",
      expectedPrice: 73,
      marketPrice: 69,
      teamAbbreviation: "LAR",
      byeWeek: 8,
    },
    {
      name: "Jahmyr Gibbs",
      position: "RB",
      expectedPrice: 72,
      marketPrice: 70,
      teamAbbreviation: "DET",
      byeWeek: 5,
    },
  ];
  const initialRosters: readonly LiveDraftRoomInitialRosterPlayer[] = [{
    teamId: team.id,
    playerId: "puka-nacua",
    playerName: "Puka Nacua",
    position: "WR",
    price: 50,
    keeperRound: 2,
    expectedPrice: 73,
    source: "keeper",
  }];
  const repository = new InMemoryLiveDraftRoomRepository();
  const created = repository.createRoom({
    roomId: "room-1",
    season,
    commissionerUserId: actor.userId,
    viewerPasswordHashRef: "viewer-hash",
    startsAt: new Date(now.getTime() + 60_000),
    playerCatalog: catalog,
    createdAt: now,
  });
  const synchronized = repository.synchronizeInitialRostersForSeason({
    seasonId: season.id,
    actor,
    initialRosters,
    playerCatalog: catalog,
    expectedRevision: created.revision,
    idempotencyKey: "sync-1",
    now: new Date(now.getTime() + 1_000),
  });
  if (synchronized === null) throw new Error("Expected a live room.");
  const started = repository.startRoom({
    roomId: created.roomId,
    actor,
    expectedRevision: synchronized.revision,
    idempotencyKey: "start-1",
    now: new Date(now.getTime() + 2_000),
  });
  const paused = repository.pauseRoom({
    roomId: created.roomId, actor, expectedRevision: started.revision,
    idempotencyKey: "pause-1", now: new Date(now.getTime() + 3_000),
  });
  const resumed = repository.resumeRoom({
    roomId: created.roomId, actor, expectedRevision: paused.revision,
    idempotencyKey: "resume-1", now: new Date(now.getTime() + 4_000),
  });
  const sold = repository.logSaleCommand({
    roomId: created.roomId, actor, expectedRevision: resumed.revision,
    idempotencyKey: "sale-1", sale: { teamId: team.id, playerName: "Jahmyr Gibbs", price: 70 },
    now: new Date(now.getTime() + 5_000),
  });
  const saleEvent = sold.events.find(event => event.type === "sale_logged");
  if (saleEvent === undefined) throw new Error("Expected a sale event.");
  const corrected = repository.correctSale({
    roomId: created.roomId, actor, expectedRevision: sold.revision,
    idempotencyKey: "correct-1", saleEventId: saleEvent.id,
    replacementSale: { teamId: team.id, playerName: "Jahmyr Gibbs", price: 71 },
    now: new Date(now.getTime() + 6_000),
  });
  const undone = repository.undoLastSale({
    roomId: created.roomId, actor, expectedRevision: corrected.revision,
    idempotencyKey: "undo-1", now: new Date(now.getTime() + 7_000),
  });
  const ended = repository.endRoom({
    roomId: created.roomId, actor, expectedRevision: undone.revision,
    idempotencyKey: "end-1", allowIncomplete: true,
    now: new Date(now.getTime() + 8_000),
  });
  const reopened = repository.reopenRoom({
    roomId: created.roomId, actor, expectedRevision: ended.revision,
    idempotencyKey: "reopen-1", now: new Date(now.getTime() + 9_000),
  });
  return [ended, reopened];
};
