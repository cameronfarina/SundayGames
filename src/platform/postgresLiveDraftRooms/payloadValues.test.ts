import { describe, expect, it } from "vitest";
import { initialRostersValue, saleValue } from "./payloadValues.js";
import { isCompactSnapshot } from "./snapshotCodec.js";

describe("Postgres live draft payload validation", () => {
  it("hydrates a persisted sale without trusting its JSON shape", () => {
    expect(saleValue({
      saleEventId: "sale-1",
      input: "cam puka 62",
      teamId: "team-1",
      ownerId: "owner-1",
      ownerDisplayName: "Cam",
      teamDisplayName: "Short King",
      playerName: "Puka Nacua",
      normalizedPlayerName: "puka nacua",
      position: "WR",
      price: 62,
      expectedPrice: 60,
    })).toMatchObject({ playerName: "Puka Nacua", position: "WR", price: 62 });
  });

  it("rejects malformed sale and roster payloads", () => {
    expect(() => saleValue({ position: "WR" })).toThrow(
      "Postgres draft room event payload was malformed.",
    );
    expect(() => initialRostersValue([{
      teamId: "team-1",
      playerName: "Puka Nacua",
      position: "WR",
      price: 62,
      source: "waiver",
    }])).toThrow("Postgres draft room event payload was malformed.");
  });

  it("recognizes only supported compact recovery snapshots", () => {
    expect(isCompactSnapshot({
      formatVersion: 2,
      room: {
        status: "paused",
        revision: 4,
        updatedAt: "2026-08-14T12:00:00.000Z",
        endedAt: null,
      },
    })).toBe(true);
    expect(isCompactSnapshot({
      formatVersion: 2,
      room: {
        status: "archived",
        revision: 4,
        updatedAt: "2026-08-14T12:00:00.000Z",
        endedAt: null,
      },
    })).toBe(false);
  });
});
