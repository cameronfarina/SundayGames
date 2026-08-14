import { describe, expect, it } from "vitest";
import { readLiveDraftLocation } from "./liveDraftLocation";

describe("readLiveDraftLocation", () => {
  it("reads encoded season and room identifiers", () => {
    expect(readLiveDraftLocation(new URLSearchParams(
      "seasonId=season%2F1&roomId=room%2F1",
    ))).toEqual({ ok: true, roomId: "room/1", seasonId: "season/1" });
  });

  it("rejects links missing either identifier", () => {
    expect(readLiveDraftLocation(new URLSearchParams("roomId=room-1"))).toEqual({
      ok: false,
      message: "This draft link is missing its league season.",
    });
    expect(readLiveDraftLocation(new URLSearchParams("seasonId=season-1"))).toEqual({
      ok: false,
      message: "This draft link is missing its room.",
    });
  });
});
