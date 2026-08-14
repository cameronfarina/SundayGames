import { describe, expect, it } from "vitest";
import {
  commissioner,
  createRoom,
  InMemoryLiveDraftRoomRepository,
  LiveDraftRoomError,
  multiwordTeamSeason,
  startRoom,
} from "./fixtures.js";

describe("live draft rooms", () => {
  it("logs natural-language sales for multiword owner names, team names, and unique aliases", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository, { season: multiwordTeamSeason() });
    startRoom(repository);

    const ownerSale = repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "sale:multiword-owner",
      sale: "Owner11 Audit drafted Puka Nacua for 62",
    });
    const teamSale = repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 3,
      idempotencyKey: "sale:multiword-team",
      sale: "Audit Angels drafted Xavier Legette for 2",
    });
    const aliasSale = repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 4,
      idempotencyKey: "sale:unique-alias",
      sale: "Owner11 Aud drafted Amon-Ra St. Brown for 50",
    });

    expect(ownerSale.projection.sales.at(-1)).toMatchObject({
      ownerDisplayName: "Owner11 Audit",
      teamDisplayName: "Audit Aces",
      playerName: "Puka Nacua",
    });
    expect(teamSale.projection.sales.at(-1)).toMatchObject({
      ownerDisplayName: "Owner12 Audit",
      teamDisplayName: "Audit Angels",
      playerName: "Xavier Legette",
    });
    expect(aliasSale.projection.sales.at(-1)).toMatchObject({
      ownerDisplayName: "Owner11 Audit",
      teamDisplayName: "Audit Aces",
      playerName: "Amon-Ra St. Brown",
    });
  });

  it("returns matching teams when a live sale owner or team alias is ambiguous", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository, { season: multiwordTeamSeason() });
    startRoom(repository);

    expect(() => repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "sale:ambiguous-team",
      sale: "Audit drafted Puka Nacua for 62",
    })).toThrow(new LiveDraftRoomError(
      "owner_not_found",
      'Owner or team "Audit" matches multiple teams: Owner11 Audit - Audit Aces, Owner12 Audit - Audit Angels.',
    ));
  });
});
