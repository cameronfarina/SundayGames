import {
  InMemoryLiveDraftRoomRepository,
  type LiveDraftRoom,
  type LiveDraftRoomActor,
  type LiveDraftRoomInitialRosterPlayer,
} from "../../src/platform/liveDraftRooms.js";
import { catalog, leagueId, season } from "./seasonFixture.js";

const initialRosters: readonly LiveDraftRoomInitialRosterPlayer[] = [
  { teamId: "team_cam", playerName: "Owner11 Quarterback", position: "QB", price: 20 },
  { teamId: "team_cam", playerName: "De'Von Achane", position: "RB", price: 50 },
  { teamId: "team_sam", playerName: "Owner12 Quarterback", position: "QB", price: 8 },
  { teamId: "team_sam", playerName: "Owner12 Running Back", position: "RB", price: 12 },
  { teamId: "team_nick", playerName: "Nick Quarterback", position: "QB", price: 7 },
  { teamId: "team_nick", playerName: "Nick Running Back", position: "RB", price: 11 },
  { teamId: "team_seth", playerName: "Owner04 Quarterback", position: "QB", price: 6 },
  { teamId: "team_seth", playerName: "Owner04 Running Back", position: "RB", price: 10 },
];

const commissioner: LiveDraftRoomActor = {
  userId: "user_commissioner",
  leagueId,
  role: "admin",
};

export const endedRoom = (): LiveDraftRoom => {
  const repository = new InMemoryLiveDraftRoomRepository();
  repository.createRoom({
    roomId: "room_sunday_2026",
    commissionerUserId: commissioner.userId,
    viewerPasswordHashRef: "viewer-password-hash",
    season: season(),
    playerCatalog: catalog,
    initialRosters,
    createdAt: new Date("2026-09-01T18:00:00.000Z"),
  });
  repository.startRoom({
    roomId: "room_sunday_2026",
    actor: commissioner,
    expectedRevision: 1,
    idempotencyKey: "start-room",
    now: new Date("2026-09-01T19:00:00.000Z"),
  });

  return repository.endRoom({
    roomId: "room_sunday_2026",
    actor: commissioner,
    expectedRevision: 2,
    idempotencyKey: "end-room",
    now: new Date("2026-09-01T22:00:00.000Z"),
  });
};
