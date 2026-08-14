import { describe, expect, it } from "vitest";
import {
  commissioner,
  createRoom,
  InMemoryLiveDraftRoomRepository,
  LiveDraftRoomError,
  now,
  startRoom,
} from "./fixtures.js";

describe("live draft rooms", () => {
  it("corrects an active sale append-only and restores the original when the correction is undone", () => {
    const repository = new InMemoryLiveDraftRoomRepository();
    createRoom(repository);
    startRoom(repository);
    const sold = repository.logSaleCommand({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 2,
      idempotencyKey: "sale:puka:62",
      sale: "owner11 puka 62",
      now: new Date(now.getTime() + 2_000),
    });
    const originalSale = sold.projection.sales[0];
    if (originalSale === undefined) throw new Error("Expected original sale fixture.");

    const correctionInput: Parameters<InMemoryLiveDraftRoomRepository["correctSale"]>[0] = {
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 3,
      idempotencyKey: "correct:puka:owner04:41",
      saleEventId: originalSale.saleEventId,
      replacementSale: { ownerText: "Owner04", playerName: "Puka Nacua", price: 41 },
      now: new Date(now.getTime() + 3_000),
    };
    const corrected = repository.correctSale(correctionInput);

    expect(corrected).toMatchObject({ status: "live", revision: 4 });
    expect(corrected.events.at(-1)).toMatchObject({
      type: "sale_corrected",
      correctedSaleEventId: originalSale.saleEventId,
      previousSale: expect.objectContaining({ ownerDisplayName: "Owner11", price: 62 }),
      replacementSale: expect.objectContaining({ ownerDisplayName: "Owner04", price: 41 }),
    });
    expect(corrected.projection.sales).toEqual([
      expect.objectContaining({
        saleEventId: "room_sunday-rev-4-sale_corrected",
        ownerDisplayName: "Owner04",
        playerName: "Puka Nacua",
        price: 41,
      }),
    ]);
    expect(corrected.projection.teams.find(team => team.ownerDisplayName === "Owner11")?.spent).toBe(0);
    expect(corrected.projection.teams.find(team => team.ownerDisplayName === "Owner04")?.spent).toBe(41);
    expect(repository.correctSale(correctionInput)).toBe(corrected);
    expect(() =>
      repository.correctSale({
        ...correctionInput,
        expectedRevision: corrected.revision,
        idempotencyKey: "correct:inactive-original",
      }),
    ).toThrow(new LiveDraftRoomError(
      "sale_not_active",
      "Only an active sale can be corrected.",
    ));

    const restored = repository.undoLastSale({
      roomId: "room_sunday",
      actor: commissioner,
      expectedRevision: 4,
      idempotencyKey: "undo:puka:correction",
      now: new Date(now.getTime() + 4_000),
    });

    expect(restored.projection.sales).toEqual([
      expect.objectContaining({
        saleEventId: originalSale.saleEventId,
        ownerDisplayName: "Owner11",
        price: 62,
      }),
    ]);
  });
});
